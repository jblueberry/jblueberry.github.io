import type { AstroConfig, RewritePayload, RouteData } from '../../@types/astro.js';
export type FindRouteToRewrite = {
    payload: RewritePayload;
    routes: RouteData[];
    request: Request;
    trailingSlash: AstroConfig['trailingSlash'];
    buildFormat: AstroConfig['build']['format'];
    base: AstroConfig['base'];
};
export declare function findRouteToRewrite({ payload, routes, request, trailingSlash, buildFormat, base, }: FindRouteToRewrite): [RouteData, URL];
