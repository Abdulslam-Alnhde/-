/**
 * بديل خفيف لـ framer-motion — حركة CSS فقط.
 * يجب إزالة خصائص الحركة من الـ props قبل تمريرها للـ DOM.
 */

"use client";

import React, { forwardRef, HTMLAttributes } from "react";

type MotionExtra = {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  whileInView?: unknown;
  viewport?: unknown;
  layout?: unknown;
  layoutId?: unknown;
  variants?: unknown;
};

interface MotionDivProps extends HTMLAttributes<HTMLDivElement>, MotionExtra {}

function stripMotion(
  props: MotionDivProps & Record<string, unknown>
): HTMLAttributes<HTMLDivElement> {
  const {
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    whileHover: _wh,
    whileTap: _wt,
    whileInView: _wiv,
    viewport: _vp,
    layout: _l,
    layoutId: _lid,
    variants: _v,
    ...html
  } = props;
  return html;
}

const MotionDiv = forwardRef<HTMLDivElement, MotionDivProps>((props, ref) => {
  const html = stripMotion(props as Record<string, unknown>);
  const { className = "", style, children, ...rest } = html;
  return (
    <div
      ref={ref}
      className={`animate-fade-in ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
});
MotionDiv.displayName = "MotionDiv";

const MotionArticle = forwardRef<HTMLElement, MotionDivProps>((props, ref) => {
  const html = stripMotion(props as Record<string, unknown>);
  const { className = "", style, children, ...rest } = html;
  return (
    <article
      ref={ref as React.Ref<HTMLElement>}
      className={`animate-fade-in ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </article>
  );
});
MotionArticle.displayName = "MotionArticle";

const MotionTr = forwardRef<HTMLTableRowElement, any>((props, ref) => {
  const html = stripMotion(props as Record<string, unknown>);
  const { className = "", style, children, ...rest } = html;
  return (
    <tr
      ref={ref}
      className={`animate-fade-in ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </tr>
  );
});
MotionTr.displayName = "MotionTr";

export function AnimatePresence({
  children,
}: {
  children: React.ReactNode;
  mode?: string;
}) {
  return <>{children}</>;
}

const MotionSpan = forwardRef<HTMLSpanElement, any>((props, ref) => {
  const html = stripMotion(props as Record<string, unknown>);
  const { className = "", children, ...rest } = html;
  return (
    <span ref={ref} className={`animate-fade-in ${className}`} {...rest}>
      {children}
    </span>
  );
});
MotionSpan.displayName = "MotionSpan";

const MotionP = forwardRef<HTMLParagraphElement, any>((props, ref) => {
  const html = stripMotion(props as Record<string, unknown>);
  const { className = "", children, ...rest } = html;
  return (
    <p ref={ref} className={`animate-fade-in ${className}`} {...rest}>
      {children}
    </p>
  );
});
MotionP.displayName = "MotionP";

export const motion = {
  div: MotionDiv,
  article: MotionArticle,
  tr: MotionTr,
  span: MotionSpan,
  p: MotionP,
};
