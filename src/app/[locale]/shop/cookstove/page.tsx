import { categoryPage } from '@/components/category-view';

/** Section « cookstove » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('cookstove', 'cookstove');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
