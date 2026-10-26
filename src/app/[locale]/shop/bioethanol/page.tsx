import { categoryPage } from '@/components/category-view';

/** Section « bioethanol » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('bioethanol', 'bioethanol');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
