import * as React from "react";

import { UploadButton as UploadButtonImpl } from "./components/upload-button";
import { UploadDropzone as UploadDropzoneImpl } from "./components/upload-dropzone";
import type {
  UploadButtonProps,
} from "./components/upload-button";
import type {
  UploadDropzoneProps,
} from "./components/upload-dropzone";
import { useUploadInternal } from "./use-upload";
import type {
  AnyFileRouterLike,
  RouteSlug,
  RouterConfigLike,
  UseUploadOptions,
} from "./types";

export type {
  AnyFileRouterLike,
  RouteOutputBySlug,
  RouteSlug,
  SiloProgressEvent,
  SiloUploadErrorShape,
  UploadCompletion,
  UseUploadOptions,
  UseUploadResult,
} from "./types";
export { SiloUploadError } from "./types";

export interface CreateSiloReactOptions {
  endpoint: string;
  fetch?: typeof fetch;
  routerConfig?: RouterConfigLike;
}

export function createSiloReact<TRouter extends AnyFileRouterLike>(
  options: CreateSiloReactOptions,
) {
  const RouterConfigContext = React.createContext<RouterConfigLike | null>(
    options.routerConfig ?? null,
  );

  function SiloRouterConfigProvider(props: {
    routerConfig: RouterConfigLike;
    children: React.ReactNode;
  }) {
    return React.createElement(
      RouterConfigContext.Provider,
      { value: props.routerConfig },
      props.children,
    );
  }

  function useUpload<TEndpoint extends RouteSlug<TRouter>>(
    uploadOptions: UseUploadOptions<TRouter, TEndpoint>,
  ) {
    return useUploadInternal<TRouter, TEndpoint>(
      {
        endpointUrl: options.endpoint,
        fetchImpl: options.fetch ?? fetch,
        initialRouterConfig: options.routerConfig,
      },
      RouterConfigContext,
      uploadOptions,
    );
  }

  function UploadButton<TEndpoint extends RouteSlug<TRouter>>(
    props: Omit<UploadButtonProps<TRouter, TEndpoint>, "useUpload">,
  ) {
    const component = UploadButtonImpl as unknown as React.JSXElementConstructor<
      UploadButtonProps<TRouter, TEndpoint>
    >;
    return React.createElement(component, {
      ...props,
      useUpload,
    });
  }

  function UploadDropzone<TEndpoint extends RouteSlug<TRouter>>(
    props: Omit<UploadDropzoneProps<TRouter, TEndpoint>, "useUpload">,
  ) {
    const component = UploadDropzoneImpl as unknown as React.JSXElementConstructor<
      UploadDropzoneProps<TRouter, TEndpoint>
    >;
    return React.createElement(component, {
      ...props,
      useUpload,
    });
  }

  return {
    useUpload,
    UploadButton,
    UploadDropzone,
    SiloRouterConfigProvider,
  };
}
