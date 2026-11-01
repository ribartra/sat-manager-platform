import { MathContent } from "@/components/math-content";

interface OptionContentProps {
  text: string;
  imageUrl?: string | null;
  label: string;
  className?: string;
}

/** Answer choice body: its text, or its image for image-only choices (e.g. graph options) at min(natural, container) width. */
export function OptionContent({ text, imageUrl, label, className }: OptionContentProps) {
  if (text.trim() || !imageUrl) return <MathContent content={text} className={className} />;
  return (
    // Option images come from configurable storage, so Next image domains are not fixed here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={`Choice ${label}`} className="block h-auto max-w-full rounded border border-gray-200 bg-white" />
  );
}
