import { Package } from "lucide-react";
import ApplicationForm from "@/components/ApplicationForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Package className="w-8 h-8 text-primary" />
          <span className="text-2xl font-bold text-primary">TALAADTHAI</span>
        </div>
        <div className="text-xl font-bold text-primary">CAREERS</div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-6">Join Our Team</h1>
          <p className="text-lg text-foreground/80 leading-relaxed max-w-2xl mx-auto">
            We're looking for talented individuals to join our company. Fill out the form below to apply!
          </p>
        </div>

        {/* Application Form */}
        <ApplicationForm />
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 text-center text-muted-foreground">
        <p>&copy; 2025 TALAADTHAI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Index;
