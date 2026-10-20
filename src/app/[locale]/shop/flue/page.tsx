import { categoryPage } from '@/components/category-view';

/** Section « flue » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('flue', 'flue');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
