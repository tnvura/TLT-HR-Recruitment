import PublicApplicationForm from "@/components/PublicApplicationForm";
import logo from "@/assets/talaadthai-logo.png";

const Index = () => {

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center">
          <div className="flex flex-col items-start">
            <img src={logo} alt="TALAADTHAI" className="h-24 w-auto mb-2" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-6">Join Our Team</h1>
          <p className="text-lg text-foreground/80 leading-relaxed max-w-2xl mx-auto">
            We're looking for talented individuals to join our company. 
          </p>
          <p className="text-lg text-foreground/80 leading-relaxed max-w-2xl mx-auto">
            Fill out the form below to apply!
          </p>
        </div>

        {/* Application Form */}
        <PublicApplicationForm />
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 text-center text-muted-foreground">
        <p>&copy; 2025 TALAADTHAI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Index;
