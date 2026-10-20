import { categoryPage } from '@/components/category-view';

/** Section « pellet » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('pellet', 'pellet');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
