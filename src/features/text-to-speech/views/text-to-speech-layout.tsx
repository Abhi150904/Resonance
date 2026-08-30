import { PageHeader } from "@/components/page-header";


export function TextToSpeechLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-full min-h-0">
            <PageHeader title="Text To Speech" />
            <div className="flex min-h-0 flex-1">
                {children}
            </div>
        </div>
    );
}