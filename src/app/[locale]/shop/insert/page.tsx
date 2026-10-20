import { categoryPage } from '@/components/category-view';

/** Section « insert » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('insert', 'insert');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
