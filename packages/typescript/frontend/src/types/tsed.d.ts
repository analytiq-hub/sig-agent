declare module '@tsed/react-formio' {
    interface FormioConfig {
        use: (template: unknown) => void;
    }

    interface TemplatesConfig {
        framework: string;
    }

    export const Formio: FormioConfig;
    export const Templates: TemplatesConfig;
}

declare module '@tsed/tailwind-formio' {
    const tailwind: {
        templates: Record<string, unknown>;
        framework: string;
    };
    export default tailwind;
} 