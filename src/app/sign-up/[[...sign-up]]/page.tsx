import { SignUp } from "@clerk/nextjs";


export default function SignUpPage() {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <SignUp
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