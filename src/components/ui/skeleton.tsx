import * as React from "react";
import { cn } from "@utils/cn";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
