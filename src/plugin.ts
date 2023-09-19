import {
  SigninPopupArgs,
  SigninRedirectArgs,
  SigninSilentArgs,
  SignoutPopupArgs,
  SignoutRedirectArgs,
  SignoutSilentArgs,
  User,
  UserManager,
  UserManagerSettings,
  SessionStatus,
  Log,
  ILogger,
} from "oidc-client-ts";
import { App, InjectionKey, Ref, inject, ref } from "vue";
import { Router } from "vue-router";

const AUTH_KEY: InjectionKey<OidcAuth> = Symbol("oidc");
const AUTH_TOKEN = "$oidc";

export interface OidcAuth {
  isLoading: Ref<boolean>;
  isAuthenticated: Ref<boolean>;
  user: Ref<User | null>;
  error: Ref<Error | null>;
  signinPopup(args?: SigninPopupArgs): Promise<User | null>;
  signinSilent(args?: SigninSilentArgs): Promise<User | null>;
  signinRedirect(args?: SigninRedirectArgs): Promise<void>;
  signoutPopup(args?: SignoutPopupArgs): Promise<void>;
  signoutRedirect(args?: SignoutRedirectArgs): Promise<void>;
  signoutSilent(args?: SignoutSilentArgs): Promise<void>;
  clearStaleState(): Promise<void>;
  querySessionStatus(): Promise<SessionStatus | null>;
  revokeTokens(): Promise<void>;
  startSilentRenew(): Promise<void>;
  stopSilenRenew(): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bindPluginMethods(plugin: any, exclude: string[]) {
  Object.getOwnPropertyNames(Object.getPrototypeOf(plugin))
    .filter((method) => !exclude.includes(method))
    .forEach((method) => (plugin[method] = plugin[method].bind(plugin)));
}

export function useOidcAuth() {
  return inject(AUTH_KEY);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLUGIN_NOT_INSTALLED_HANDLER: any = () => {
  console.error(`Please ensure Auth0's Vue plugin is correctly installed.`);
};

const PLUGIN_NOT_INSTALLED_IMPLEMENTATION: OidcAuth = {
  isLoading: ref(false),
  isAuthenticated: ref(false),
  user: ref(null),
  error: ref(null),
  signinPopup: PLUGIN_NOT_INSTALLED_HANDLER,
  signinSilent: PLUGIN_NOT_INSTALLED_HANDLER,
  signinRedirect: PLUGIN_NOT_INSTALLED_HANDLER,
  signoutPopup: PLUGIN_NOT_INSTALLED_HANDLER,
  signoutRedirect: PLUGIN_NOT_INSTALLED_HANDLER,
  signoutSilent: PLUGIN_NOT_INSTALLED_HANDLER,
  clearStaleState: PLUGIN_NOT_INSTALLED_HANDLER,
  querySessionStatus: PLUGIN_NOT_INSTALLED_HANDLER,
  revokeTokens: PLUGIN_NOT_INSTALLED_HANDLER,
  startSilentRenew: PLUGIN_NOT_INSTALLED_HANDLER,
  stopSilenRenew: PLUGIN_NOT_INSTALLED_HANDLER,
};

export const client: Ref<OidcAuth> = ref(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PLUGIN_NOT_INSTALLED_IMPLEMENTATION as any,
);

export interface PluginSettings {
  logger: ILogger,
  log: Log
}

export class OidcPlugin implements OidcAuth {
  private _userManager!: UserManager;
  public isLoading: Ref<boolean> = ref(true);
  public isAuthenticated: Ref<boolean> = ref(false);
  public user: Ref<User | null> = ref(null);
  public error: Ref<Error | null> = ref(null);

  constructor(private userManagerSettings: UserManagerSettings, private pluginSettings: PluginSettings = { logger: console, log: Log.NONE }) {
    bindPluginMethods(this, ["constructor"]);
  }

  install(app: App) {
    this._userManager = new UserManager(this.userManagerSettings);
    Log.setLogger(this.pluginSettings.logger);
    Log.setLevel(this.pluginSettings.log);
    this._userManager.events.addUserLoaded((user) =>
      this.__updateStateWithUser(user),
    );
    this._userManager.events.addUserUnloaded(() =>
      this.__updateStateWithUser(null),
    );
    this._userManager.events.addSilentRenewError((error: Error) => {
      this.error.value = error;
    });

    this._userManager.events.addAccessTokenExpired(async () => {
      const user = await this._userManager.getUser();
      this.__updateStateWithUser(user);
    });

    this.__proxy(() =>
      this.__init(app.config.globalProperties.$router),
    );

    app.config.globalProperties[AUTH_TOKEN] = this;
    app.provide(AUTH_KEY, this as OidcAuth);

    client.value = this as OidcAuth;
  }

  async signinPopup(args?: SigninPopupArgs): Promise<User> {
    return this.__proxy(() => this._userManager.signinPopup(args));
  }

  async signinSilent(args?: SigninSilentArgs): Promise<User | null> {
    return this.__proxy(() => this._userManager.signinSilent(args));
  }

  async signinRedirect(args?: SigninRedirectArgs): Promise<void> {
    return this.__proxy(() => this._userManager.signinRedirect(args));
  }

  async signoutPopup(args?: SignoutPopupArgs): Promise<void> {
    return this.__proxy(() => this._userManager.signoutPopup(args));
  }

  async signoutRedirect(args?: SignoutRedirectArgs): Promise<void> {
    return this.__proxy(() => this._userManager.signoutRedirect(args));
  }

  async signoutSilent(args?: SignoutSilentArgs): Promise<void> {
    return this.__proxy(() => this._userManager.signoutSilent(args));
  }

  async clearStaleState() {
    return this._userManager.clearStaleState();
  }

  async querySessionStatus() {
    return this._userManager.querySessionStatus();
  }

  async revokeTokens() {
    return this._userManager.revokeTokens();
  }

  async startSilentRenew() {
    return this._userManager.startSilentRenew();
  }

  async stopSilenRenew() {
    return this._userManager.stopSilentRenew();
  }

  private async __init(router?: Router) {
    const search = window.location.search;
    try {
      const isOidcCallback =
        (search.includes("code=") || search.includes("error=")) &&
        search.includes("state=");

      if (isOidcCallback) {
        const user = await this._userManager.signinCallback();
        const state = user?.state as { to: string } | null;
        const target = state ? state.to : null;
        window.history.replaceState({}, "", "/");
        if (router) {
          await router.replace(target || "/");
        }
        if(user) {
          this.__updateStateWithUser(user);
        }
      } else {
        const user = await this._userManager.getUser();
        console.log(user);
        try {
          const signinSilent = this.userManagerSettings.automaticSilentRenew && this.userManagerSettings.silent_redirect_uri !== undefined;
          if(signinSilent) {
            const refreshedUser = await this._userManager.signinSilent();
            this.__updateStateWithUser(refreshedUser);
          } else {
            this.__updateStateWithUser(user);
          }
        } catch (e) {
          this.__updateStateWithUser(user);
          throw e;
        }
      }
    } catch (e) {
      window.history.replaceState({}, "", "/");

      if (router) {
        router.push("/"); //TODO setup option to add error path.
      }
    }
  }

  private async __updateStateWithUser(user: User | null) {
    this.isAuthenticated.value = user !== null && !user?.expired;
    this.user.value = user;
    this.isLoading.value = false;
  }

  private async __proxy<T>(f: () => T) {
    let res;
    try {
      this.isLoading.value = true;
      res = await f();
      this.isLoading.value = false;
      this.error.value = null;
    } catch (e) {
      this.isLoading.value = false;
      this.error.value = e as Error;
      throw e;
    }
    return res;
  }
}
