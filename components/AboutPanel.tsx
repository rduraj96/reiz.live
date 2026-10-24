"use client";

import * as Dialog from "@radix-ui/react-dialog";

export function AboutPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-muted bg-background p-6 text-foreground">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-2xl font-bold tracking-tight">ABOUT</Dialog.Title>
            <Dialog.Close aria-label="Close" className="size-11 text-2xl text-muted hover:text-foreground">
              ×
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-base leading-relaxed text-gray-200">
            REIZDIO is free live radio with a 3D visualizer that moves to the music. Stations come from the
            community-run Radio Browser directory; only streams the visualizer can read are listed. Built by Rei
            Duraj.
          </Dialog.Description>
          <a
            href="https://github.com/rduraj96/reiz.live"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center text-accent underline"
          >
            GitHub
          </a>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
