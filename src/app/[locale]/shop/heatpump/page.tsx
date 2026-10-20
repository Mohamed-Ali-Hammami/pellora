import { categoryPage } from '@/components/category-view';

/** Section « heatpump » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('heatpump', 'heatpump');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
