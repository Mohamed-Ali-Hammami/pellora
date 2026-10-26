import { categoryPage } from '@/components/category-view';

/** Section « electricfire » — le gabarit est partagé, voir `category-view.tsx`. */
const page = categoryPage('electricfire', 'electricfire');

export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.Page;
