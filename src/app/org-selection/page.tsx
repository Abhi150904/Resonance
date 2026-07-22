import { OrganizationList } from "@clerk/nextjs";

export default function OrganizationListPage() {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <OrganizationList
                hidePersonal
                afterCreateOrganizationUrl="/"
                afterSelectOrganizationUrl="/"
                appearance={{
                    elements: {
                        rootBox: "mx-auto",
                        card: "shadow-lg"
                    }
                }}
            />
        </div>
    )
}
