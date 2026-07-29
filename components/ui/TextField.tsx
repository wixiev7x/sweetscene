import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const BASE_INPUT =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all";

export function TextField({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${BASE_INPUT} ${className}`} />;
}

export function TextArea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`${BASE_INPUT} resize-none min-h-[120px] max-h-[300px] ${className}`}
    />
  );
}