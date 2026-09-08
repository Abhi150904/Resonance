
import { createTRPCRouter } from '../init';
import { generationsRouter } from './generations';
import { voicesRouter } from './voices'
export const appRouter = createTRPCRouter({
    voices: voicesRouter,
    generation: generationsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;