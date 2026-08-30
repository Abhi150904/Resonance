import { Suspense } from "react";
import { HealthCheck } from "./health-check"
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ErrorBoundary } from "react-error-boundary";

export default function TestPage() {
    prefetch(trpc.health.queryOptions())
    return (
        <HydrateClient>
            <div className="flex flex-col items-center justify-center gap-4 p-8">
                <h1 className="text-2xl font-bold">
                    tRPC Test Page
                </h1>
                <ErrorBoundary fallback={<div className="text-red-500">Something went wrong</div>}>
                    <Suspense fallback={<div>loading...</div>}>
                        <HealthCheck />
                    </Suspense>
                </ErrorBoundary>


            </div>


        </HydrateClient>

    );
};