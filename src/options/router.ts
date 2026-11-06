// src/options/router.ts
// Hash-based client-side router for Options page (02_AppFlow §3)

export type RouteHandler = (container: HTMLElement) => Promise<void> | void;

export class HashRouter {
  private routes = new Map<string, RouteHandler>();
  private defaultRoute = '#/general';
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public register(hash: string, handler: RouteHandler): this {
    this.routes.set(hash, handler);
    return this;
  }

  public navigate(hash: string): void {
    window.location.hash = hash;
  }

  public start(): void {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  private handleRoute(): void {
    const hash = window.location.hash || this.defaultRoute;
    if (!this.routes.has(hash)) {
      window.location.hash = this.defaultRoute;
      return;
    }

    // Update active state on sidebar navigation links
    document.querySelectorAll('.nav-link').forEach((link) => {
      const href = link.getAttribute('href');
      if (href === hash) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });

    const handler = this.routes.get(hash);
    if (handler) {
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }
      handler(this.container);
    }
  }
}
