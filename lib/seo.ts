import type { Metadata } from "next";

/**
 * Page metadata helper — one consistent shape for title, description,
 * OpenGraph and Twitter cards across every route. The root layout's
 * title template appends "· SweetScene" automatically.
 */
export function pageMeta({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
