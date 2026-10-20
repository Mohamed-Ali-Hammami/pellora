import { categoryPage } from '@/components/category-view';

/** Section « accessory » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('accessory', 'accessory');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
