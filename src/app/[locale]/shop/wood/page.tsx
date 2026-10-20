import { categoryPage } from '@/components/category-view';

/** Section « wood » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('wood', 'wood');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
