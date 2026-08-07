import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-base font-semibold whitespace-nowrap transition-all duration-100 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.97] active:shadow-inner disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 gpu-accelerated",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-95 active:opacity-90 shadow-sm shadow-primary/15",
        outline:
          "border-border bg-background hover:bg-accent hover:text-foreground active:bg-accent/85 aria-expanded:bg-accent aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:opacity-90 active:opacity-85 aria-expanded:bg-secondary",
        ghost:
          "hover:bg-accent hover:text-foreground active:bg-accent/85 aria-expanded:bg-accent aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/30 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-13 gap-2 px-6 rounded-lg text-[16px] md:text-[17px]",
        xs: "h-8 gap-1 rounded-md px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 rounded-md px-4 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-14 gap-2.5 px-8 rounded-lg text-[17px] md:text-[18px]",
        icon: "size-13 rounded-lg",
        "icon-xs":
          "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-10 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-14 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ExtendedButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  readonly loading?: boolean;
}

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ExtendedButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin shrink-0" />}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }

