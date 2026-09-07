"use client";

import React, { useCallback } from "react";

type BurstChildProps = {
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
};

export default function HeartBurst({ children }: { children: React.ReactElement<BurstChildProps> }) {
  const burst = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const host = e.currentTarget;
    host.classList.remove("hb-pop");
    void host.offsetWidth;
    host.classList.add("hb-pop");
    window.setTimeout(() => host.classList.remove("hb-pop"), 320);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = host.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = 0; i < 10; i++) {
      const span = document.createElement("span");
      span.className = "hb-heart";
      span.textContent = "♥";
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.6;
      const dist = 28 + Math.random() * 34;
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      span.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
      span.style.setProperty("--ty", `${Math.sin(angle) * dist - 12}px`);
      span.style.setProperty("--rot", `${Math.random() * 60 - 30}deg`);
      host.appendChild(span);
      window.setTimeout(() => span.remove(), 700);
    }
  }, []);

  const child = children as React.ReactElement<BurstChildProps>;
  return React.cloneElement(child, {
    ...child.props,
    className: `${child.props.className ?? ""} hb-host`.trim(),
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      burst(e);
      child.props.onClick?.(e);
    },
  });
}
