import { SignIn } from "@clerk/nextjs";


export default function SignInPage() {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <SignIn
                appearance={{
                    elements: {
                        rootBox: "mx-auto",
                        card: "shadow-lg"
                    }
                }}
            />
        </div>
    );
}