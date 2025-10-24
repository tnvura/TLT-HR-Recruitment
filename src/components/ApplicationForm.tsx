import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, ArrowLeft } from "lucide-react";
import logo from "@/assets/talaadthai-logo.png";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

const formSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  first_name_en: z.string().trim().max(100).optional(),
  last_name_en: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Invalid email address").max(255),
  phone_number: z.string().trim().optional(),
  current_position: z.string().trim().optional(),
  current_employer: z.string().trim().optional(),
  education_level: z.string().trim().optional(),
  institution: z.string().trim().optional(),
  position_applied: z.string().trim().min(1, "Position applied is required").max(200),
  years_of_experience: z.string().min(1, "Years of experience is required"),
  message: z.string().trim().optional(),
  cv_file: z.instanceof(File).optional().refine(
    (file) => !file || file.size <= MAX_FILE_SIZE,
    "File size must be less than 10MB"
  ).refine(
    (file) => !file || ACCEPTED_FILE_TYPES.includes(file.type),
    "Only PDF and DOCX files are accepted"
  ),
});

type FormData = z.infer<typeof formSchema>;

export default function ApplicationForm() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      first_name_en: "",
      last_name_en: "",
      email: "",
      phone_number: "",
      current_position: "",
      current_employer: "",
      education_level: "",
      institution: "",
      position_applied: "",
      years_of_experience: "",
      message: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      form.setValue("cv_file", file);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      let cvFileUrl = null;
      let cvFileName = null;

      // Upload CV file if provided
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('CVS')
          .upload(filePath, selectedFile);

        if (uploadError) {
          throw uploadError;
        }

        // Store the file path (not public URL since bucket is private)
        cvFileUrl = filePath;
        cvFileName = selectedFile.name;
      }

      // Insert candidate data
      const { error: insertError } = await supabase
        .from('candidates')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          first_name_en: data.first_name_en || null,
          last_name_en: data.last_name_en || null,
          email: data.email,
          phone_number: data.phone_number || null,
          current_position: data.current_position || null,
          current_employer: data.current_employer || null,
          education_level: data.education_level || null,
          institution: data.institution || null,
          position_applied: data.position_applied,
          years_of_experience: data.years_of_experience,
          message: data.message || null,
          cv_file_url: cvFileUrl,
          cv_file_name: cvFileName,
          status: 'new',
        });

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Application Submitted!",
        description: "Thank you for your application. We'll be in touch soon.",
      });

      form.reset();
      setSelectedFile(null);
      
      // Redirect to candidates page
      navigate('/candidates');
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="TalaadThai" className="h-24 w-auto mb-2" />
          <Button variant="outline" onClick={() => navigate('/candidates')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Candidates
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="bg-card rounded-lg shadow-md p-8 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground mb-8">Submit Your Application</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">First Name (Thai) *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="First Name (Thai)" className="bg-secondary/50 border-border h-12" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Last Name (Thai) *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Last Name (Thai)" className="bg-secondary/50 border-border h-12" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* English Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="first_name_en"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">First Name (English)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="First Name (English)" className="bg-secondary/50 border-border h-12" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name_en"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Last Name (English)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Last Name (English)" className="bg-secondary/50 border-border h-12" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Email and Phone */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-medium">Email Address *</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="Email Address" className="bg-secondary/50 border-border h-12" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-medium">Phone Number</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" placeholder="Phone Number" className="bg-secondary/50 border-border h-12" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Current Employment */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-4">Current Employment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="current_position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-medium">Current Position</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Current Position" className="bg-secondary/50 border-border h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="current_employer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-medium">Current Employer</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Current Employer" className="bg-secondary/50 border-border h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Education */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-4">Education</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="education_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-medium">Education Level</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Bachelor's Degree" className="bg-secondary/50 border-border h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="institution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-medium">Institution</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Institution" className="bg-secondary/50 border-border h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Application Details */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-4">Application Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="position_applied"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-medium">Position Applied *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Position Applied" className="bg-secondary/50 border-border h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="years_of_experience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-medium">Years of Experience *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary/50 border-border h-12">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border z-50">
                        <SelectItem value="0-1">0-1 years</SelectItem>
                        <SelectItem value="1-3">1-3 years</SelectItem>
                        <SelectItem value="3-5">3-5 years</SelectItem>
                        <SelectItem value="5-10">5-10 years</SelectItem>
                        <SelectItem value="10+">10+ years</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Message */}
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-medium">Message</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    className="bg-secondary/50 border-border min-h-[100px]"
                    placeholder="Tell us why you'd be a great fit..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* File Upload */}
          <FormField
            control={form.control}
            name="cv_file"
            render={() => (
              <FormItem>
                <FormLabel className="text-foreground font-medium">Upload CV</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-6 py-3 bg-secondary/50 text-foreground border border-border rounded-md cursor-pointer hover:bg-secondary/70 transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>Choose File</span>
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <span className="text-sm text-muted-foreground">
                      {selectedFile ? selectedFile.name : "No file chosen"}
                    </span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          </div>
        </form>
      </Form>
        </div>
      </div>
    </div>
  );
}
