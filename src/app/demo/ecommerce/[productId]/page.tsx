import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getProduct, products } from '@/lib/demo/products';
import { ProductDetail } from '@/components/demo/ecommerce/product-detail';

interface ProductPageProps {
  params: Promise<{ productId: string }>;
}

export async function generateStaticParams() {
  return products.map((p) => ({ productId: p.id }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { productId } = await params;
  const product = getProduct(productId);
  if (!product) return { title: 'Product Not Found' };
  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params;
  const product = getProduct(productId);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <ProductDetail product={product} />
    </main>
  );
}
