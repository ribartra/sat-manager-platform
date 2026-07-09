interface QuestionMediaProps {
  imageUrl?: string | null;
  alt?: string;
  className?: string;
}

export function QuestionMedia({ imageUrl, alt = "Question image", className = "" }: QuestionMediaProps) {
  if (!imageUrl) return null;

  return (
    <a href={imageUrl} target="_blank" rel="noreferrer" className={`block ${className}`}>
      {/* External SAT question assets can come from configurable storage, so Next image domains are not fixed here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        className="max-h-96 w-full rounded-md border border-gray-200 object-contain"
      />
    </a>
  );
}
