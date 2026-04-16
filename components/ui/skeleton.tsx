import { cn } from "@/lib/utils"

function Skeleton({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md animate-shimmer", className)}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--muted) 0%, var(--background) 40%, var(--muted) 80%)",
        backgroundSize: "200% 100%",
        ...style,
      }}
      {...props}
    />
  )
}

export { Skeleton }
