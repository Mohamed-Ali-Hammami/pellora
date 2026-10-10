//+------------------------------------------------------------------+
//|                                                  TrendBasket.mq5 |
//|                                                                  |
//|  Suivi de tendance multi-instruments (breakout de Donchian)      |
//|  Specification complete : trading-bot/docs/STRATEGY.md           |
//|                                                                  |
//|  Principes de conception :                                       |
//|   - Decisions sur bougies CLOSES uniquement (pas de look-ahead)  |
//|   - Stop-loss serveur toujours pose (survit a une deconnexion)   |
//|   - Sizing par volatilite : risque constant en devise de compte  |
//|   - Trade REFUSE si le lot calcule < lot minimum (jamais arrondi)|
//|   - Plafonds de risque par groupe correle + coupe-circuits       |
//+------------------------------------------------------------------+
#property copyright "Trading bot - suivi de tendance"
#property link      ""
#property version   "1.00"
#property description "Suivi de tendance sur panier (Donchian H4 + filtre de regime D1)."
#property description "Lire docs/STRATEGY.md avant utilisation. A tester en DEMO."

#include <Trade\Trade.mqh>

//--- Univers ---------------------------------------------------------
input group "=== Univers ==="
input string  InpSymbols            = "XAUUSD,XAGUSD,BTCUSD,ETHUSD"; // Symboles (separes par virgule)
input string  InpSymbolSuffix       = "";                            // Suffixe broker (ex: ".m", "_raw")
input string  InpGroupDefs          = "XAU,XAG;BTC,ETH";             // Groupes correles (membres ','  groupes ';')

//--- Horizons --------------------------------------------------------
input group "=== Horizons ==="
input ENUM_TIMEFRAMES InpEntryTF    = PERIOD_H4;   // UT de signal et de gestion
input ENUM_TIMEFRAMES InpRegimeTF   = PERIOD_D1;   // UT du filtre de regime
input ENUM_TIMEFRAMES InpStopTF     = PERIOD_D1;   // UT de l'ATR du stop et du sizing

//--- Signal ----------------------------------------------------------
input group "=== Signal ==="
input int     InpDonchianEntry      = 60;    // Canal d'entree (bougies UT signal)
input int     InpDonchianExit       = 30;    // Canal de sortie (bougies UT signal)
input int     InpRegimeMaPeriod     = 200;   // Periode EMA du filtre de regime
input int     InpAtrPeriod          = 14;    // Periode ATR
input double  InpAtrSpikeMult       = 2.5;   // Rejet si ATR > mult x mediane(ATR)
input int     InpAtrSpikeLookback   = 100;   // Fenetre de la mediane ATR
input double  InpMaxSpreadAtrFrac   = 0.08;  // Rejet si spread > frac x ATR
input bool    InpAllowLong          = true;  // Autoriser les achats
input bool    InpAllowShort         = true;  // Autoriser les ventes

//--- Risque ----------------------------------------------------------
input group "=== Risque ==="
input double  InpAtrStopMult        = 3.0;   // Stop initial et suiveur = mult x ATR
input double  InpRiskPctPerTrade    = 1.0;   // Risque par trade (% equity)
input double  InpGroupRiskCapPct    = 1.5;   // Risque cumule max par groupe (%)
input double  InpPortfolioHeatCapPct= 4.0;   // Risque cumule max portefeuille (%)
input double  InpDailyLossStopPct   = 5.0;   // Coupe-circuit journalier (%)
input double  InpMaxDrawdownStopPct = 25.0;  // Coupe-circuit drawdown total (%)
input double  InpMaxMarginUsePct    = 50.0;  // Marge max utilisee par une entree (% marge libre)

//--- Execution --------------------------------------------------------
input group "=== Execution ==="
input ulong   InpMagic              = 20261010; // Magic number (isole cet EA)
input ulong   InpSlippagePoints     = 50;       // Deviation max (points)
input int     InpTimerSeconds       = 15;       // Periode du timer (gere les symboles hors chart)
input bool    InpVerbose            = true;     // Journalisation detaillee

//+------------------------------------------------------------------+
//| Etat par symbole                                                 |
//+------------------------------------------------------------------+
struct SymbolState
{
   string   name;            // nom complet avec suffixe
   string   group;           // identifiant de groupe correle
   int      hAtr;            // handle ATR sur UT de signal (filtres)
   int      hAtrStop;        // handle ATR sur UT du stop (distance + sizing)
   int      hRegimeMa;       // handle EMA sur UT de regime
   datetime lastBarTime;     // derniere bougie de signal traitee
   int      digits;
   double   point;
   bool     logged_unavailable;
};

SymbolState g_sym[];
int         g_count = 0;
CTrade      g_trade;

// Coupe-circuits (persistes cote terminal pour survivre a un redemarrage)
string      g_gvPeak  = "";
string      g_gvDayEq = "";
string      g_gvDayNo = "";
bool        g_halted  = false;

//+------------------------------------------------------------------+
//| Utilitaires                                                      |
//+------------------------------------------------------------------+
void Log(const string msg)
{
   if(InpVerbose) Print(msg);
}

void LogAlways(const string msg)
{
   Print(msg);
}

//--- Nombre de decimales implique par un pas de volume
int VolumeDigits(const double step)
{
   if(step <= 0.0) return 2;
   double s = step;
   int d = 0;
   while(s < 1.0 - 1e-12 && d < 8)
   {
      s *= 10.0;
      d++;
   }
   return d;
}

//--- Mediane d'un tableau (copie, ne modifie pas l'entree)
double Median(const double &src[], const int n)
{
   if(n <= 0) return 0.0;
   double tmp[];
   ArrayResize(tmp, n);
   for(int i = 0; i < n; i++) tmp[i] = src[i];
   ArraySort(tmp);
   if(n % 2 == 1) return tmp[n / 2];
   return 0.5 * (tmp[n / 2 - 1] + tmp[n / 2]);
}

//--- Determine le groupe correle d'un symbole a partir de InpGroupDefs.
//    Un symbole qui ne matche aucun groupe recoit son propre groupe.
string ResolveGroup(const string symbol)
{
   string groups[];
   int ng = StringSplit(InpGroupDefs, StringGetCharacter(";", 0), groups);
   for(int g = 0; g < ng; g++)
   {
      string members[];
      int nm = StringSplit(groups[g], StringGetCharacter(",", 0), members);
      for(int m = 0; m < nm; m++)
      {
         string key = members[m];
         StringTrimLeft(key);
         StringTrimRight(key);
         if(StringLen(key) == 0) continue;
         if(StringFind(symbol, key) >= 0)
            return "G" + IntegerToString(g);
      }
   }
   return "SOLO_" + symbol;
}

//+------------------------------------------------------------------+
//| Initialisation                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // --- Validation des entrees : echouer tot plutot que mal trader
   if(InpDonchianEntry < 5 || InpDonchianExit < 3)
   {
      LogAlways("ERREUR: canaux de Donchian trop courts.");
      return INIT_PARAMETERS_INCORRECT;
   }
   if(InpAtrPeriod < 2 || InpAtrStopMult <= 0.0)
   {
      LogAlways("ERREUR: parametres ATR invalides.");
      return INIT_PARAMETERS_INCORRECT;
   }
   if(InpRiskPctPerTrade <= 0.0 || InpRiskPctPerTrade > 10.0)
   {
      LogAlways("ERREUR: InpRiskPctPerTrade doit etre dans ]0 ; 10].");
      return INIT_PARAMETERS_INCORRECT;
   }
   // Un plafond inferieur au risque par trade rend la condition
   // (risque_cumule + risque_prevu > plafond) vraie des la premiere entree,
   // meme avec zero position ouverte : AUCUN trade ne serait jamais pris, en
   // silence. On echoue donc a l'initialisation plutot que de laisser l'EA
   // tourner sans rien faire.
   if(InpGroupRiskCapPct < InpRiskPctPerTrade)
   {
      LogAlways(StringFormat("ERREUR: InpGroupRiskCapPct (%.2f%%) < InpRiskPctPerTrade (%.2f%%). "
                             "Aucune entree ne serait possible. Augmente le plafond de groupe.",
                             InpGroupRiskCapPct, InpRiskPctPerTrade));
      return INIT_PARAMETERS_INCORRECT;
   }
   if(InpPortfolioHeatCapPct < InpRiskPctPerTrade)
   {
      LogAlways(StringFormat("ERREUR: InpPortfolioHeatCapPct (%.2f%%) < InpRiskPctPerTrade (%.2f%%). "
                             "Aucune entree ne serait possible. Augmente le plafond de portefeuille.",
                             InpPortfolioHeatCapPct, InpRiskPctPerTrade));
      return INIT_PARAMETERS_INCORRECT;
   }

   // --- Construction de l'univers
   string raw[];
   int n = StringSplit(InpSymbols, StringGetCharacter(",", 0), raw);
   if(n <= 0)
   {
      LogAlways("ERREUR: InpSymbols est vide.");
      return INIT_PARAMETERS_INCORRECT;
   }

   ArrayResize(g_sym, n);
   g_count = 0;

   for(int i = 0; i < n; i++)
   {
      string s = raw[i];
      StringTrimLeft(s);
      StringTrimRight(s);
      if(StringLen(s) == 0) continue;
      s = s + InpSymbolSuffix;

      if(!SymbolSelect(s, true))
      {
         LogAlways("ATTENTION: symbole introuvable chez le broker, ignore : " + s);
         continue;
      }

      SymbolState st;
      st.name                = s;
      st.group               = ResolveGroup(s);
      st.hAtr                = INVALID_HANDLE;
      st.hAtrStop            = INVALID_HANDLE;
      st.hRegimeMa           = INVALID_HANDLE;
      st.lastBarTime         = 0;
      st.digits              = (int)SymbolInfoInteger(s, SYMBOL_DIGITS);
      st.point               = SymbolInfoDouble(s, SYMBOL_POINT);
      st.logged_unavailable  = false;

      g_sym[g_count] = st;
      g_count++;
   }

   if(g_count == 0)
   {
      LogAlways("ERREUR: aucun symbole utilisable. Verifie les noms et InpSymbolSuffix.");
      return INIT_FAILED;
   }

   ArrayResize(g_sym, g_count);

   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(InpSlippagePoints);

   // Noms des variables globales terminal (prefixees par magic : plusieurs
   // instances de l'EA peuvent coexister sans se marcher dessus)
   string pfx = "TB_" + IntegerToString((long)InpMagic) + "_";
   g_gvPeak  = pfx + "peakEq";
   g_gvDayEq = pfx + "dayEq";
   g_gvDayNo = pfx + "dayNo";

   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   if(!GlobalVariableCheck(g_gvPeak)) GlobalVariableSet(g_gvPeak, eq);

   EventSetTimer((int)MathMax(1, InpTimerSeconds));

   string listing = "";
   for(int i = 0; i < g_count; i++)
      listing += g_sym[i].name + "[" + g_sym[i].group + "] ";
   LogAlways("TrendBasket initialise. Univers: " + listing);
   LogAlways(StringFormat("Risque/trade=%.2f%%  plafond groupe=%.2f%%  heat max=%.2f%%  stop jour=%.2f%%  stop DD=%.2f%%",
                          InpRiskPctPerTrade, InpGroupRiskCapPct, InpPortfolioHeatCapPct,
                          InpDailyLossStopPct, InpMaxDrawdownStopPct));

   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   for(int i = 0; i < g_count; i++)
   {
      if(g_sym[i].hAtr      != INVALID_HANDLE) IndicatorRelease(g_sym[i].hAtr);
      if(g_sym[i].hAtrStop  != INVALID_HANDLE) IndicatorRelease(g_sym[i].hAtrStop);
      if(g_sym[i].hRegimeMa != INVALID_HANDLE) IndicatorRelease(g_sym[i].hRegimeMa);
   }
}

void OnTick()
{
   ProcessAll();
}

// Le timer est indispensable : OnTick ne se declenche que sur les ticks du
// symbole du graphique. Sans timer, un graphique sur l'or laisserait les
// positions crypto non gerees le week-end.
void OnTimer()
{
   ProcessAll();
}

//+------------------------------------------------------------------+
//| Creation paresseuse des handles d'indicateurs                    |
//| (en backtest, l'historique d'un symbole hors chart peut ne pas   |
//|  etre pret au premier tick)                                      |
//+------------------------------------------------------------------+
bool EnsureHandles(SymbolState &st)
{
   if(st.hAtr == INVALID_HANDLE)
      st.hAtr = iATR(st.name, InpEntryTF, InpAtrPeriod);
   if(st.hAtrStop == INVALID_HANDLE)
      st.hAtrStop = iATR(st.name, InpStopTF, InpAtrPeriod);
   if(st.hRegimeMa == INVALID_HANDLE)
      st.hRegimeMa = iMA(st.name, InpRegimeTF, InpRegimeMaPeriod, 0, MODE_EMA, PRICE_CLOSE);
   return (st.hAtr != INVALID_HANDLE && st.hAtrStop != INVALID_HANDLE
           && st.hRegimeMa != INVALID_HANDLE);
}

bool HistoryReady(SymbolState &st)
{
   int needEntry  = MathMax(InpDonchianEntry, InpAtrSpikeLookback + InpAtrPeriod) + 10;
   int needRegime = InpRegimeMaPeriod + 10;
   int needStop   = InpAtrPeriod + 10;
   if(Bars(st.name, InpEntryTF)  < needEntry)  return false;
   if(Bars(st.name, InpRegimeTF) < needRegime) return false;
   if(Bars(st.name, InpStopTF)   < needStop)   return false;
   return true;
}

//+------------------------------------------------------------------+
//| Coupe-circuits                                                   |
//+------------------------------------------------------------------+
void UpdateEquityTracking()
{
   double eq = AccountInfoDouble(ACCOUNT_EQUITY);

   // Pic d'equity (pour le drawdown)
   double peak = GlobalVariableCheck(g_gvPeak) ? GlobalVariableGet(g_gvPeak) : eq;
   if(eq > peak)
   {
      peak = eq;
      GlobalVariableSet(g_gvPeak, peak);
   }

   // Equity d'ouverture du jour
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   double dayNo = (double)(dt.year * 10000 + dt.mon * 100 + dt.day);
   double storedDay = GlobalVariableCheck(g_gvDayNo) ? GlobalVariableGet(g_gvDayNo) : -1.0;
   if(MathAbs(storedDay - dayNo) > 0.5)
   {
      GlobalVariableSet(g_gvDayNo, dayNo);
      GlobalVariableSet(g_gvDayEq, eq);
   }
}

// Retourne true si de NOUVELLES entrees sont interdites.
// Les positions deja ouvertes continuent d'etre gerees (stops suiveurs,
// sorties) : couper la gestion serait pire que de ne pas entrer.
bool EntriesBlocked(string &reason)
{
   double eq = AccountInfoDouble(ACCOUNT_EQUITY);

   double peak = GlobalVariableCheck(g_gvPeak) ? GlobalVariableGet(g_gvPeak) : eq;
   if(peak > 0.0)
   {
      double ddPct = 100.0 * (peak - eq) / peak;
      if(ddPct >= InpMaxDrawdownStopPct)
      {
         reason = StringFormat("coupe-circuit DRAWDOWN: -%.2f%% depuis le pic (limite %.2f%%)",
                               ddPct, InpMaxDrawdownStopPct);
         if(!g_halted)
         {
            g_halted = true;
            LogAlways("ARRET DES ENTREES - " + reason);
         }
         return true;
      }
   }

   double dayEq = GlobalVariableCheck(g_gvDayEq) ? GlobalVariableGet(g_gvDayEq) : eq;
   if(dayEq > 0.0)
   {
      double dayPct = 100.0 * (dayEq - eq) / dayEq;
      if(dayPct >= InpDailyLossStopPct)
      {
         reason = StringFormat("coupe-circuit JOURNALIER: -%.2f%% aujourd'hui (limite %.2f%%)",
                               dayPct, InpDailyLossStopPct);
         return true;
      }
   }

   return false;
}

//+------------------------------------------------------------------+
//| Conversion distance de prix -> montant en devise de compte       |
//+------------------------------------------------------------------+
double ValuePerPricePerLot(const string symbol)
{
   double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0.0) tickSize = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(tickSize <= 0.0) return 0.0;

   double tickVal = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_LOSS);
   if(tickVal <= 0.0) tickVal = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   if(tickVal <= 0.0) return 0.0;

   return tickVal / tickSize;
}

//+------------------------------------------------------------------+
//| Risque courant d'une position, en devise de compte               |
//|                                                                  |
//| Definition retenue : seule la part du trajet vers le stop qui    |
//| passe SOUS le prix d'entree (au-dessus pour un short) compte.    |
//| Un stop remonte au-dela de l'entree compte donc pour 0 : rendre  |
//| du profit latent n'est pas du risque sur capital initial.        |
//+------------------------------------------------------------------+
double PositionRiskMoney(const string symbol, const long type,
                         const double entry, const double sl, const double volume)
{
   if(sl <= 0.0) return volume * entry * ValuePerPricePerLot(symbol); // pas de stop : risque traite comme enorme

   double vpp = ValuePerPricePerLot(symbol);
   if(vpp <= 0.0) return 0.0;

   double riskPrice = 0.0;
   if(type == POSITION_TYPE_BUY)
   {
      double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      double ref = MathMin(bid > 0.0 ? bid : entry, entry);
      riskPrice = MathMax(0.0, ref - sl);
   }
   else
   {
      double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
      double ref = MathMax(ask > 0.0 ? ask : entry, entry);
      riskPrice = MathMax(0.0, sl - ref);
   }

   return riskPrice * volume * vpp;
}

//+------------------------------------------------------------------+
//| Agregats de risque sur les positions de cet EA                   |
//+------------------------------------------------------------------+
void AggregateRisk(const string groupFilter, double &groupRisk, double &totalRisk)
{
   groupRisk = 0.0;
   totalRisk = 0.0;

   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;

      string psym  = PositionGetString(POSITION_SYMBOL);
      long   ptype = PositionGetInteger(POSITION_TYPE);
      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl    = PositionGetDouble(POSITION_SL);
      double vol   = PositionGetDouble(POSITION_VOLUME);

      double r = PositionRiskMoney(psym, ptype, entry, sl, vol);
      totalRisk += r;

      // Le groupe est resolu depuis l'univers configure, pas depuis la position,
      // pour rester coherent avec InpGroupDefs.
      for(int k = 0; k < g_count; k++)
      {
         if(g_sym[k].name == psym)
         {
            if(g_sym[k].group == groupFilter) groupRisk += r;
            break;
         }
      }
   }
}

//--- Position ouverte par cet EA sur ce symbole ?
bool FindOwnPosition(const string symbol, ulong &ticket)
{
   ticket = 0;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(!PositionSelectByTicket(t)) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;
      ticket = t;
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Lecture des indicateurs sur la derniere bougie CLOSE             |
//+------------------------------------------------------------------+
bool ReadAtr(SymbolState &st, double &atr, double &atrMedian)
{
   atr = 0.0;
   atrMedian = 0.0;

   double buf[];
   int need = InpAtrSpikeLookback;
   if(CopyBuffer(st.hAtr, 0, 1, need, buf) != need) return false;

   // CopyBuffer sans ArraySetAsSeries renvoie l'ordre chronologique :
   // le dernier element est la bougie close la plus recente.
   atr = buf[need - 1];
   if(atr <= 0.0) return false;

   atrMedian = Median(buf, need);
   return true;
}

// ATR de la derniere bougie CLOSE de l'UT du stop. Sert a la distance de stop
// et donc a la taille de position, pas aux filtres d'entree.
bool ReadAtrStop(SymbolState &st, double &atrStop)
{
   atrStop = 0.0;
   double buf[];
   if(CopyBuffer(st.hAtrStop, 0, 1, 1, buf) != 1) return false;
   atrStop = buf[0];
   return (atrStop > 0.0);
}

bool ReadRegime(SymbolState &st, int &dir)
{
   dir = 0;
   double ma[];
   if(CopyBuffer(st.hRegimeMa, 0, 1, 1, ma) != 1) return false;

   double c = iClose(st.name, InpRegimeTF, 1);
   if(c <= 0.0 || ma[0] <= 0.0) return false;

   if(c > ma[0]) dir = 1;
   else if(c < ma[0]) dir = -1;
   return true;
}

// Canal de Donchian sur les bougies [2 .. n+1] : la bougie de signal [1]
// est volontairement exclue de son propre canal.
bool ReadChannel(SymbolState &st, const int n, double &hi, double &lo)
{
   hi = 0.0;
   lo = 0.0;
   double highs[], lows[];
   if(CopyHigh(st.name, InpEntryTF, 2, n, highs) != n) return false;
   if(CopyLow(st.name,  InpEntryTF, 2, n, lows)  != n) return false;

   int iHi = ArrayMaximum(highs);
   int iLo = ArrayMinimum(lows);
   if(iHi < 0 || iLo < 0) return false;

   hi = highs[iHi];
   lo = lows[iLo];
   return (hi > 0.0 && lo > 0.0);
}

//+------------------------------------------------------------------+
//| Gestion d'une position ouverte                                   |
//+------------------------------------------------------------------+
void ManageOpenPosition(SymbolState &st, const ulong ticket, const double atrStop)
{
   if(!PositionSelectByTicket(ticket)) return;

   long     type     = PositionGetInteger(POSITION_TYPE);
   double   entry    = PositionGetDouble(POSITION_PRICE_OPEN);
   double   curSl    = PositionGetDouble(POSITION_SL);
   double   curTp    = PositionGetDouble(POSITION_TP);
   datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);

   // --- 1. Sortie sur canal de Donchian inverse (bougie close)
   double exHi, exLo;
   if(ReadChannel(st, InpDonchianExit, exHi, exLo))
   {
      double c1 = iClose(st.name, InpEntryTF, 1);
      if(c1 > 0.0)
      {
         bool exitNow = (type == POSITION_TYPE_BUY && c1 < exLo)
                     || (type == POSITION_TYPE_SELL && c1 > exHi);
         if(exitNow)
         {
            g_trade.SetTypeFillingBySymbol(st.name);
            if(g_trade.PositionClose(ticket, InpSlippagePoints))
               LogAlways(st.name + ": SORTIE canal inverse (close=" + DoubleToString(c1, st.digits)
                         + ", canal=" + DoubleToString(exLo, st.digits)
                         + "/" + DoubleToString(exHi, st.digits) + ")");
            else
               LogAlways(st.name + ": ECHEC sortie canal inverse, retcode="
                         + IntegerToString((int)g_trade.ResultRetcode()));
            return;
         }
      }
   }

   // --- 2. Stop suiveur "chandelier", a cliquet uniquement
   //
   // L'extremum depuis l'entree est RECALCULE depuis les bougies, pas garde
   // en memoire : l'EA retrouve donc le bon stop apres un redemarrage du
   // terminal ou un rechargement.
   double extreme = entry;
   if(type == POSITION_TYPE_BUY)
   {
      double highs[];
      int got = CopyHigh(st.name, InpEntryTF, openTime, TimeCurrent(), highs);
      if(got > 0)
      {
         int idx = ArrayMaximum(highs);
         if(idx >= 0) extreme = MathMax(entry, highs[idx]);
      }
   }
   else
   {
      double lows[];
      int got = CopyLow(st.name, InpEntryTF, openTime, TimeCurrent(), lows);
      if(got > 0)
      {
         int idx = ArrayMinimum(lows);
         if(idx >= 0) extreme = MathMin(entry, lows[idx]);
      }
   }

   double rawSl = (type == POSITION_TYPE_BUY)
                ? extreme - InpAtrStopMult * atrStop
                : extreme + InpAtrStopMult * atrStop;

   double newSl = NormalizeDouble(rawSl, st.digits);

   // Respect de la distance minimale imposee par le broker
   long   stopsLvl = SymbolInfoInteger(st.name, SYMBOL_TRADE_STOPS_LEVEL);
   double minDist  = (double)stopsLvl * st.point;
   double bid      = SymbolInfoDouble(st.name, SYMBOL_BID);
   double ask      = SymbolInfoDouble(st.name, SYMBOL_ASK);

   if(type == POSITION_TYPE_BUY)
   {
      if(bid > 0.0 && newSl > bid - minDist) newSl = NormalizeDouble(bid - minDist, st.digits);
      // Cliquet : on ne desserre jamais un stop.
      if(curSl > 0.0 && newSl <= curSl) return;
   }
   else
   {
      if(ask > 0.0 && newSl < ask + minDist) newSl = NormalizeDouble(ask + minDist, st.digits);
      if(curSl > 0.0 && newSl >= curSl) return;
   }

   // Evite les modifications inutiles (bruit de journal et charge serveur)
   if(curSl > 0.0 && MathAbs(newSl - curSl) < st.point * 0.5) return;

   g_trade.SetTypeFillingBySymbol(st.name);
   if(g_trade.PositionModify(ticket, newSl, curTp))
      Log(st.name + ": stop suiveur " + DoubleToString(curSl, st.digits)
          + " -> " + DoubleToString(newSl, st.digits));
   else
      Log(st.name + ": echec modification stop (retcode="
          + IntegerToString((int)g_trade.ResultRetcode()) + ")");
}

//+------------------------------------------------------------------+
//| Tentative d'ouverture                                            |
//+------------------------------------------------------------------+
// atr     : UT de signal, sert aux filtres (choc de volatilite, spread)
// atrStop : UT du stop, sert a la distance de stop et au sizing
void TryOpen(SymbolState &st, const double atr, const double atrStop,
             const double atrMedian, const int regimeDir,
             const double chHi, const double chLo)
{
   double c1 = iClose(st.name, InpEntryTF, 1);
   if(c1 <= 0.0) return;

   // --- Signal de breakout, filtre par le regime
   int dir = 0;
   if(InpAllowLong  && regimeDir ==  1 && c1 > chHi) dir =  1;
   if(InpAllowShort && regimeDir == -1 && c1 < chLo) dir = -1;
   if(dir == 0) return;

   // --- Filtre de choc de volatilite
   if(atrMedian > 0.0 && atr > InpAtrSpikeMult * atrMedian)
   {
      Log(st.name + ": entree refusee - choc de volatilite (ATR=" + DoubleToString(atr, st.digits)
          + " > " + DoubleToString(InpAtrSpikeMult, 2) + " x mediane="
          + DoubleToString(atrMedian, st.digits) + ")");
      return;
   }

   // --- Filtre de spread
   double ask = SymbolInfoDouble(st.name, SYMBOL_ASK);
   double bid = SymbolInfoDouble(st.name, SYMBOL_BID);
   if(ask <= 0.0 || bid <= 0.0) return;
   double spread = ask - bid;
   if(spread > InpMaxSpreadAtrFrac * atr)
   {
      Log(st.name + ": entree refusee - spread " + DoubleToString(spread, st.digits)
          + " > " + DoubleToString(InpMaxSpreadAtrFrac, 3) + " x ATR ("
          + DoubleToString(InpMaxSpreadAtrFrac * atr, st.digits) + ")");
      return;
   }

   // --- Niveaux
   double entryPrice = (dir == 1) ? ask : bid;
   double stopDist   = InpAtrStopMult * atrStop;
   if(stopDist <= 0.0) return;

   long   stopsLvl = SymbolInfoInteger(st.name, SYMBOL_TRADE_STOPS_LEVEL);
   double minDist  = (double)stopsLvl * st.point;
   if(stopDist < minDist)
   {
      Log(st.name + ": entree refusee - stop ATR (" + DoubleToString(stopDist, st.digits)
          + ") sous la distance minimale du broker (" + DoubleToString(minDist, st.digits) + ")");
      return;
   }

   double sl = (dir == 1) ? entryPrice - stopDist : entryPrice + stopDist;
   sl = NormalizeDouble(sl, st.digits);

   // --- Sizing par volatilite
   double equity    = AccountInfoDouble(ACCOUNT_EQUITY);
   double riskMoney = equity * InpRiskPctPerTrade / 100.0;
   double vpp       = ValuePerPricePerLot(st.name);
   if(vpp <= 0.0)
   {
      LogAlways(StringFormat("%s: entree refusee - valeur du tick indisponible.", st.name));
      return;
   }

   double rawLots = riskMoney / (stopDist * vpp);

   double step = SymbolInfoDouble(st.name, SYMBOL_VOLUME_STEP);
   double vmin = SymbolInfoDouble(st.name, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(st.name, SYMBOL_VOLUME_MAX);
   if(step <= 0.0) step = 0.01;

   double lots = MathFloor(rawLots / step + 1e-9) * step;
   lots = NormalizeDouble(lots, VolumeDigits(step));

   // REFUS explicite si le lot calcule est sous le minimum broker.
   // Arrondir au minimum ici multiplierait silencieusement le risque reel.
   if(lots < vmin - 1e-12)
   {
      LogAlways(st.name + ": entree REFUSEE - lot requis " + DoubleToString(rawLots, 4)
                + " < minimum broker " + DoubleToString(vmin, 4)
                + ". Le risque de " + DoubleToString(InpRiskPctPerTrade, 2) + "% ("
                + DoubleToString(riskMoney, 2) + ") est trop petit pour un stop de "
                + DoubleToString(stopDist, st.digits)
                + ". Augmente le capital ou retire ce symbole du panier.");
      return;
   }
   if(lots > vmax)
   {
      LogAlways(StringFormat("%s: lot %.4f plafonne au maximum broker %.4f (risque reel reduit).",
                             st.name, lots, vmax));
      lots = vmax;
   }

   // --- Plafonds de risque portefeuille
   double plannedRisk = stopDist * lots * vpp;
   double groupRisk, totalRisk;
   AggregateRisk(st.group, groupRisk, totalRisk);

   double groupCap = equity * InpGroupRiskCapPct / 100.0;
   double heatCap  = equity * InpPortfolioHeatCapPct / 100.0;

   if(groupRisk + plannedRisk > groupCap + 1e-9)
   {
      Log(StringFormat("%s: entree refusee - plafond de groupe %s atteint (%.2f + %.2f > %.2f)",
                       st.name, st.group, groupRisk, plannedRisk, groupCap));
      return;
   }
   if(totalRisk + plannedRisk > heatCap + 1e-9)
   {
      Log(StringFormat("%s: entree refusee - plafond de risque portefeuille atteint (%.2f + %.2f > %.2f)",
                       st.name, totalRisk, plannedRisk, heatCap));
      return;
   }

   // --- Controle de marge
   double margin = 0.0;
   ENUM_ORDER_TYPE ot = (dir == 1) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   if(OrderCalcMargin(ot, st.name, lots, entryPrice, margin))
   {
      double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      if(margin > freeMargin * InpMaxMarginUsePct / 100.0)
      {
         LogAlways(StringFormat("%s: entree refusee - marge requise %.2f > %.1f%% de la marge libre %.2f",
                                st.name, margin, InpMaxMarginUsePct, freeMargin));
         return;
      }
   }

   // --- Envoi
   g_trade.SetTypeFillingBySymbol(st.name);
   string comment = "TB-" + (dir == 1 ? "L" : "S");

   bool ok = (dir == 1)
           ? g_trade.Buy(lots, st.name, 0.0, sl, 0.0, comment)
           : g_trade.Sell(lots, st.name, 0.0, sl, 0.0, comment);

   if(ok)
      LogAlways(st.name + ": ENTREE " + (dir == 1 ? "LONG" : "SHORT")
                + "  lots=" + DoubleToString(lots, VolumeDigits(step))
                + "  stop=" + DoubleToString(sl, st.digits)
                + "  risque=" + DoubleToString(plannedRisk, 2)
                + " (" + DoubleToString(100.0 * plannedRisk / equity, 2) + "% de "
                + DoubleToString(equity, 2) + ")"
                + "  ATR=" + DoubleToString(atr, st.digits));
   else
      LogAlways(st.name + ": ECHEC entree " + (dir == 1 ? "LONG" : "SHORT")
                + " lots=" + DoubleToString(lots, 4)
                + " retcode=" + IntegerToString((int)g_trade.ResultRetcode())
                + " (" + g_trade.ResultRetcodeDescription() + ")");
}

//+------------------------------------------------------------------+
//| Boucle principale                                                |
//+------------------------------------------------------------------+
void ProcessAll()
{
   UpdateEquityTracking();

   string blockReason = "";
   bool   blocked     = EntriesBlocked(blockReason);

   for(int i = 0; i < g_count; i++)
   {
      // Travail par reference : lastBarTime doit persister entre les appels.
      if(!EnsureHandles(g_sym[i]))  continue;
      if(!HistoryReady(g_sym[i]))
      {
         if(!g_sym[i].logged_unavailable)
         {
            g_sym[i].logged_unavailable = true;
            Log("Historique insuffisant pour " + g_sym[i].name + ", attente du telechargement.");
         }
         continue;
      }
      g_sym[i].logged_unavailable = false;

      // --- Une seule evaluation par bougie de signal close
      datetime bt = iTime(g_sym[i].name, InpEntryTF, 0);
      if(bt <= 0) continue;
      if(bt == g_sym[i].lastBarTime) continue;

      double atr, atrMedian, atrStop;
      if(!ReadAtr(g_sym[i], atr, atrMedian)) continue;
      if(!ReadAtrStop(g_sym[i], atrStop))    continue;

      // La bougie est marquee traitee ici, donc :
      //  - un echec de lecture des ATR (au-dessus) sera retente au tick suivant ;
      //  - un echec de ReadRegime/ReadChannel (en dessous) fait perdre cette
      //    bougie comme opportunite d'entree. C'est accepte : HistoryReady()
      //    a deja garanti l'historique, ces echecs sont donc transitoires et
      //    rares, et rater une entree vaut mieux que reevaluer a chaque tick.
      g_sym[i].lastBarTime = bt;

      ulong ticket = 0;
      if(FindOwnPosition(g_sym[i].name, ticket))
      {
         ManageOpenPosition(g_sym[i], ticket, atrStop);
         continue;
      }

      if(blocked)
      {
         Log(g_sym[i].name + ": pas d'entree - " + blockReason);
         continue;
      }

      int regimeDir = 0;
      if(!ReadRegime(g_sym[i], regimeDir)) continue;
      if(regimeDir == 0) continue;

      double chHi, chLo;
      if(!ReadChannel(g_sym[i], InpDonchianEntry, chHi, chLo)) continue;

      TryOpen(g_sym[i], atr, atrStop, atrMedian, regimeDir, chHi, chLo);
   }
}
//+------------------------------------------------------------------+
