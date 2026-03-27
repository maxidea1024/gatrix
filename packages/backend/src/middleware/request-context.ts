import { AsyncLocalStorage } from 'async_hooks';
import { Request } from 'express';

export const requestContext = new AsyncLocalStorage<Request>();
