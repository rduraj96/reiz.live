"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import styles from "./Takeover.module.css";

type ContentProps = ComponentProps<typeof Dialog.Content>;

type TakeoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown as the giant outlined heading; re-animates whenever it changes. */
  title: string;
  description?: ReactNode;
  onOpenAutoFocus?: ContentProps["onOpenAutoFocus"];
  onCloseAutoFocus?: ContentProps["onCloseAutoFocus"];
  children: ReactNode;
};

/** Stagger index for `staggerClass` children: rows and blocks slide in one after another. */
export const stagger = (i: number) => ({ "--i": Math.min(i, 12) }) as CSSProperties;
export const staggerClass = styles.stagger;

/** A full-screen dialog that splits open from the middle, with a giant outlined title. */
export function Takeover({ open, onOpenChange, title, description, onOpenAutoFocus, onCloseAutoFocus, children }: TakeoverProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          // Without a description, opt out of Radix's aria-describedby warning.
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className={styles.content}
        >
          <Dialog.Close aria-label="Close" className={styles.close}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Dialog.Close>
          <div className={styles.scroll}>
            <Dialog.Title key={title} className={styles.giant}>
              <span className="sr-only">{title}</span>
              <span aria-hidden="true">
                {Array.from(title).map((ch, i) => (
                  <span key={i} className={styles.letter} style={{ "--i": i } as CSSProperties}>
                    {ch === " " ? " " : ch}
                  </span>
                ))}
              </span>
            </Dialog.Title>
            {description && <Dialog.Description asChild>{description}</Dialog.Description>}
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
