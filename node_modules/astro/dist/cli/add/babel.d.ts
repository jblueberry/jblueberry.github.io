import parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
export declare const visit: {
    <S>(parent: traverse.Node, opts: traverse.TraverseOptions<S>, scope: traverse.Scope | undefined, state: S, parentPath?: traverse.NodePath): void;
    (parent: traverse.Node, opts?: traverse.TraverseOptions, scope?: traverse.Scope, state?: any, parentPath?: traverse.NodePath): void;
    visitors: typeof traverse.visitors;
    verify: typeof traverse.visitors.verify;
    explode: typeof traverse.visitors.explode;
    cheap: (node: traverse.Node, enter: (node: traverse.Node) => void) => void;
    node: (node: traverse.Node, opts: traverse.TraverseOptions, scope?: traverse.Scope, state?: any, path?: traverse.NodePath, skipKeys?: Record<string, boolean>) => void;
    clearNode: (node: traverse.Node, opts?: traverse.RemovePropertiesOptions) => void;
    removeProperties: (tree: traverse.Node, opts?: traverse.RemovePropertiesOptions) => traverse.Node;
    hasType: (tree: traverse.Node, type: traverse.Node["type"], denylistTypes?: string[]) => boolean;
    cache: typeof traverse.cache;
};
export { t };
export declare function generate(ast: t.File): Promise<string>;
export declare const parse: (code: string) => parser.ParseResult<t.File>;
