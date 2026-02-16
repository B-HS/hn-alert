import type { FC, HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export const Card: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
)

export const CardHeader: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
)

export const CardTitle: FC<HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h3 className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
)

export const CardDescription: FC<HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
)

export const CardContent: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => <div className={cn('p-6 pt-0', className)} {...props} />

export const CardFooter: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn('flex items-center p-6 pt-0', className)} {...props} />
)
