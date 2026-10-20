import { categoryPage } from '@/components/category-view';

/** Section « boiler » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('boiler', 'boiler');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
