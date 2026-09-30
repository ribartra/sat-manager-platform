"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, MouseEvent, ReactNode, forwardRef, useId } from "react";
import { Hint } from "@/components/hint";

/**
 * Blocked state shared by every control that looks like a button. It must read as unavailable
 * at a glance (neutral gray, no hover, not-allowed cursor), never as a faded live button.
 * `aria-disabled:` covers links rendered through `asChild`, which cannot take `disabled`.
 */
const BLOCKED_SOLID =
  "disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:hover:bg-gray-100 " +
  "aria-disabled:border-gray-200 aria-disabled:bg-gray-100 aria-disabled:text-gray-400 aria-disabled:shadow-none aria-disabled:hover:bg-gray-100";
const BLOCKED_BARE =
  "disabled:bg-transparent disabled:text-gray-400 disabled:no-underline disabled:hover:bg-transparent disabled:hover:text-gray-400 " +
  "aria-disabled:bg-transparent aria-disabled:text-gray-400 aria-disabled:no-underline aria-disabled:hover:bg-transparent aria-disabled:hover:text-gray-400";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed aria-disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: `bg-blue-600 text-white hover:bg-blue-700 ${BLOCKED_SOLID}`,
        default: `bg-blue-600 text-white hover:bg-blue-700 ${BLOCKED_SOLID}`,
        secondary: `border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 ${BLOCKED_SOLID}`,
        outline: `border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 ${BLOCKED_SOLID}`,
        ghost: `text-gray-700 hover:bg-gray-100 hover:text-gray-950 ${BLOCKED_BARE}`,
        link: `text-blue-700 underline-offset-4 hover:underline ${BLOCKED_BARE}`,
        danger: `bg-red-600 text-white hover:bg-red-700 ${BLOCKED_SOLID}`,
        destructive: `bg-red-600 text-white hover:bg-red-700 ${BLOCKED_SOLID}`,
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2",
        default: "h-10 px-4 py-2",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Why the action is unavailable. Setting it disables the button and shows the reason as a
   * tooltip (hover/focus) and to screen readers. Prefer it over a bare `disabled` whenever the
   * block is a business rule the user can fix (missing file, prerequisite step, permission).
   */
  disabledReason?: string | null;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, disabled, disabledReason, onClickCapture, ...props }, ref) => {
    const reasonId = useId();
    const blocked = Boolean(disabled || disabledReason);
    const classes = cn(buttonVariants({ variant, size }), className);

    let control;
    if (asChild) {
      // Links cannot be natively disabled: mark them aria-disabled, drop them from the tab
      // order and cancel the click in the capture phase (before next/link navigates).
      control = (
        <Slot
          {...props}
          ref={ref}
          className={classes}
          aria-disabled={blocked || undefined}
          tabIndex={blocked ? -1 : props.tabIndex}
          aria-describedby={disabledReason ? reasonId : props["aria-describedby"]}
          onClickCapture={(event: MouseEvent<HTMLButtonElement>) => {
            if (blocked) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            onClickCapture?.(event);
          }}
        />
      );
    } else {
      control = (
        <button
          {...props}
          ref={ref}
          className={classes}
          disabled={blocked}
          aria-describedby={disabledReason ? reasonId : props["aria-describedby"]}
          onClickCapture={onClickCapture}
        />
      );
    }

    if (!disabledReason) return control;
    return (
      <DisabledReason reason={disabledReason} id={reasonId} fullWidth={/(^|\s)w-full(\s|$)/.test(classes)}>
        {control}
      </DisabledReason>
    );
  }
);
Button.displayName = "Button";

/**
 * Shows why a control is unavailable: tooltip on hover/focus plus a screen-reader description.
 * A disabled element gets no pointer events, so the tooltip hangs off a focusable wrapper.
 * Button uses it through `disabledReason`; custom raw buttons wrap themselves with it and set
 * `aria-describedby={id}` on the control.
 */
function DisabledReason({ reason, id, fullWidth, children }: { reason: string; id: string; fullWidth?: boolean; children: ReactNode }) {
  return (
    <Hint label={reason}>
      <span
        tabIndex={0}
        className={cn(
          "inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          fullWidth && "w-full [&>*:first-child]:w-full",
        )}
      >
        {children}
        <span id={id} className="sr-only">{reason}</span>
      </span>
    </Hint>
  );
}

export { Button, DisabledReason, buttonVariants };
