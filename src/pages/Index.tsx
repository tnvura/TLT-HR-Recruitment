import { Package } from "lucide-react";
import ApplicationForm from "@/components/ApplicationForm";
import heroIllustration from "@/assets/hero-illustration.png";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Package className="w-8 h-8 text-primary" />
          <span className="text-2xl font-bold text-primary">TALAADTHAI</span>
        </div>
        <div className="text-xl font-bold text-primary">CAREERS</div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-foreground mb-6">Join Our Team</h1>
            <p className="text-lg text-foreground/80 leading-relaxed">
              We're looking for talented individuals to join our company. Fill out the form below to apply!
            </p>
          </div>
          <div className="flex justify-center">
            <img 
              src={heroIllustration} 
              alt="Person working on laptop" 
              className="w-full max-w-md"
            />
          </div>
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
