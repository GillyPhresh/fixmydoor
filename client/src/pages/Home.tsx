import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Lock, Home as HomeIcon, Users, Phone, Mail, MapPin, CheckCircle2, Zap, DollarSign, MessageCircle, Instagram, Twitter, Facebook, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { BookingRequest } from "@shared/types";

import logoPng from "./Images/FixMyDoor_Logo.PNG";
import heroImage from "./Images/step-into-the-glow.jpg";
import aboutImage from "./Images/entry-door-replacement.jpg";
import gallery1 from "./Images/kicked-down-doors.jpg";
import gallery2 from "./Images/severely-broken-wooden-door-after-forced-entry.jpg";
import gallery3 from "./Images/white-internal-doors.jpg";
import gallery4 from "./Images/one-stop-home-services.jpg";
import gallery5 from "./Images/furniture-movers-packers-abu-dhabi.jpg";
import gallery6 from "./Images/desk-monitor-plant-ai-generated.jpg";

/**
 * FixMyDoor MVP Website - Enhanced Design
 * Design: Luxury Craft Experience
 * - Rich Brown (#6B4423) + Elegant Gold (#D4A574) + Warm Cream (#F5F1E8)
 * - Montserrat Modern for clean, upscale typography
 * - Premium imagery with elegant spacing
 * - Services blend with lifestyle imagery
 */

const bookingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email address"),
  address: z.string().min(5, "Please enter your full address"),
  repairType: z.string().min(1, "Please select a service type"),
  preferredDate: z.string().optional(),
  message: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

const serviceImages = [
  { src: gallery1, alt: "Door Repair & Alignment", title: "Door Repair & Alignment", desc: "Fix stuck, squeaky, or misaligned doors with professional expertise" },
  { src: gallery2, alt: "Lock & Hinge Fixing", title: "Lock & Hinge Fixing", desc: "Repair or replace broken locks, hinges, and handles with quality parts" },
  { src: gallery3, alt: "Chair Repair", title: "Chair Repair", desc: "Restore your chairs to like-new condition with expert repairs" },
  { src: gallery4, alt: "Table Repair", title: "Table Repair", desc: "Repair wobbly tables, damaged surfaces, and broken supports" },
  { src: gallery5, alt: "General Furniture Repairs", title: "General Furniture Repairs", desc: "Fix drawers, cabinets, shelves, and all furniture issues" },
  { src: gallery6, alt: "Emergency Service", title: "Emergency Service", desc: "Same-day or next-day emergency repair services available" },
];

const galleryImages = serviceImages;

const beforeAfterImages = [
  { before: gallery1, after: gallery2, title: "Door Frame Restoration", desc: "Complete door and frame inspection and repair" },
  { before: gallery3, after: gallery4, title: "Interior Door Refinishing", desc: "Aesthetic and functional door repairs" },
  { before: gallery5, after: gallery6, title: "Furniture Transformation", desc: "Professional furniture restoration and repair" },
];

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [serviceSlide, setServiceSlide] = useState(0);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      repairType: "",
      preferredDate: "",
      message: "",
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    const payload: BookingRequest = {
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      address: data.address.trim(),
      repairType: data.repairType,
      preferredDate: data.preferredDate || undefined,
      message: data.message?.trim() || undefined,
    };

    try {
      await axios.post("/api/bookings", payload);
      toast.success("Booking request submitted! We'll contact you soon.");
      form.reset();
    } catch (error) {
      toast.error("Unable to submit booking at this time. Please try again later.");
      console.error("Booking submission error:", error);
    }
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % beforeAfterImages.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + beforeAfterImages.length) % beforeAfterImages.length);
  const nextService = () => setServiceSlide((prev) => (prev + 1) % serviceImages.length);
  const prevService = () => setServiceSlide((prev) => (prev - 1 + serviceImages.length) % serviceImages.length);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white shadow-lg border-b-4 border-primary">
        <div className="container flex items-center justify-between py-3">
          <a href="/" className="flex items-center gap-2">
            <img src={logoPng} alt="FixMyDoor logo" className="w-16 h-16 object-contain" />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary font-bold">FixMyDoor</p>
              <h1 className="text-xl font-bold text-secondary" style={{ fontFamily: 'Montserrat' }}>Door & Furniture Repair</h1>
            </div>
          </a>
          <div className="hidden md:flex gap-8 text-sm font-semibold">
            <a href="#services" className="hover:text-primary transition">Services</a>
            <a href="#before-after" className="hover:text-primary transition">Gallery</a>
            <a href="#about" className="hover:text-primary transition">About</a>
            <a href="#testimonials" className="hover:text-primary transition">Reviews</a>
            <a href="#contact" className="hover:text-primary transition">Contact</a>
          </div>
          <a href="tel:+148383471823" className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-4 rounded-lg transition">
            Call Now
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: Text Content */}
          <div className="container py-16 md:py-32 order-2 md:order-1">
            <div className="max-w-lg">
              <h1 className="text-5xl md:text-7xl font-bold text-secondary mb-6" style={{ fontFamily: 'Montserrat' }}>
                Expert Repairs,<br />Delivered to You
              </h1>
              <p className="text-xl text-foreground/80 mb-2 font-semibold">Premium Service in Montreal</p>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                Professional door and furniture repair services with Richard Ampofo. Fast, affordable, and reliable solutions for your home.
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <a href="tel:+148383471823" className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-lg text-center transform transition hover:scale-105">
                  <Phone className="inline mr-2 w-5 h-5" />
                  Call Now
                </a>
                <a href="#contact" className="bg-secondary hover:bg-secondary/90 text-white font-bold py-3 px-6 rounded-lg text-center transform transition hover:scale-105">
                  Book a Repair
                </a>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-md text-center">
                  <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-sm font-bold text-secondary">Fast Service</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md text-center">
                  <DollarSign className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-sm font-bold text-secondary">Affordable</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md text-center">
                  <CheckCircle2 className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-sm font-bold text-secondary">Expert Work</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="order-1 md:order-2 h-96 md:h-full md:min-h-screen relative">
            <img
              src={heroImage}
              alt="Professional door repair service"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent opacity-40"></div>
          </div>
        </div>
      </section>

      {/* Services Section with Images */}
      <section id="services" className="bg-gradient-to-b from-white to-background py-20">
        <div className="container">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.4em] text-primary font-bold mb-4">Our Expertise</p>
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-6" style={{ fontFamily: 'Montserrat' }}>
              Complete Repair Solutions
            </h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
              From door alignment to furniture restoration, we deliver exceptional craftsmanship for every project.
            </p>
          </div>

          {/* Image Carousel for Services */}
          <div className="relative mb-16">
            <div className="relative h-96 md:h-96 rounded-2xl overflow-hidden shadow-2xl">
              <img 
                src={serviceImages[serviceSlide].src} 
                alt={serviceImages[serviceSlide].alt}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <h3 className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: 'Montserrat' }}>
                  {serviceImages[serviceSlide].title}
                </h3>
                <p className="text-white/90">{serviceImages[serviceSlide].desc}</p>
              </div>

              {/* Navigation Buttons */}
              <button
                onClick={prevService}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-primary/80 hover:bg-primary text-white p-3 rounded-full transition"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextService}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-primary/80 hover:bg-primary text-white p-3 rounded-full transition"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Slide Indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {serviceImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setServiceSlide(i)}
                    className={`w-3 h-3 rounded-full transition ${
                      i === serviceSlide ? 'bg-primary' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Service Grid Below */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {[
                { icon: HomeIcon, title: "Door Repair", desc: "Professional alignment and repair" },
                { icon: Lock, title: "Lock & Hinges", desc: "Quality part replacements" },
                { icon: Users, title: "Furniture Repair", desc: "Complete restoration services" },
              ].map((service, i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition border-l-4 border-primary">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <service.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-secondary mb-2">{service.title}</h3>
                  <p className="text-foreground/70">{service.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Before & After Carousel */}
      <section id="before-after" className="bg-white py-20">
        <div className="container">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.4em] text-primary font-bold mb-4">Our Work</p>
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-6" style={{ fontFamily: 'Montserrat' }}>
              Repairs & Installations
            </h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
              See how we transform damaged doors and furniture into fully restored pieces.
            </p>
          </div>

          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Before Image */}
              <div className="relative h-96 rounded-xl overflow-hidden shadow-xl">
                <img 
                  src={beforeAfterImages[currentSlide].before} 
                  alt="Before"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 bg-primary text-white px-4 py-2 rounded-full font-bold text-sm">
                  Before
                </div>
              </div>

              {/* After Image */}
              <div className="relative h-96 rounded-xl overflow-hidden shadow-xl">
                <img 
                  src={beforeAfterImages[currentSlide].after} 
                  alt="After"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 bg-primary text-white px-4 py-2 rounded-full font-bold text-sm">
                  After
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={prevSlide}
                className="bg-secondary hover:bg-secondary/90 text-white p-3 rounded-full transition transform hover:scale-110"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <div className="text-center">
                <h3 className="text-2xl font-bold text-secondary mb-2" style={{ fontFamily: 'Montserrat' }}>
                  {beforeAfterImages[currentSlide].title}
                </h3>
                <p className="text-foreground/70">{beforeAfterImages[currentSlide].desc}</p>
                <div className="flex gap-2 justify-center mt-4">
                  {beforeAfterImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={`w-3 h-3 rounded-full transition ${
                        i === currentSlide ? 'bg-secondary' : 'bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={nextSlide}
                className="bg-secondary hover:bg-secondary/90 text-white p-3 rounded-full transition transform hover:scale-110"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-gradient-to-b from-background to-white py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Image */}
          <div className="h-96 md:h-96 md:min-h-96 order-2 md:order-1">
            <img
              src={aboutImage}
              alt="Richard Ampofo, FixMyDoor Technician"
              className="w-full h-full object-cover rounded-2xl shadow-2xl"
            />
          </div>

          {/* Content */}
          <div className="container py-8 md:py-0 order-1 md:order-2">
            <p className="text-sm uppercase tracking-[0.4em] text-primary font-bold mb-4">Meet the Expert</p>
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-6" style={{ fontFamily: 'Montserrat' }}>
              Richard Ampofo
            </h2>
            <p className="text-lg text-foreground/70 mb-6 leading-relaxed">
              Richard is a skilled technician with years of hands-on experience in door and furniture repair. Based in Montreal, Quebec, he's committed to delivering professional, high-quality workmanship on every job.
            </p>
            <p className="text-lg text-foreground/70 mb-6 leading-relaxed">
              Whether it's a stuck door, broken hinge, wobbly chair, or damaged table, Richard brings expertise, precision, and a commitment to customer satisfaction to every repair.
            </p>
            <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
              FixMyDoor is built on the principle that quality repairs should be accessible, affordable, and convenient. We come to you so you don't have to worry about transporting your furniture or dealing with complex repairs yourself.
            </p>
            <div className="flex gap-4">
              <a href="tel:+148383471823" className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-lg transform transition hover:scale-105">
                Schedule Now
              </a>
              <a href="mailto:info.fixmydoor@gmail.com" className="bg-secondary hover:bg-secondary/90 text-white font-bold py-3 px-6 rounded-lg transform transition hover:scale-105">
                Send Email
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="bg-white py-20">
        <div className="container">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.4em] text-primary font-bold mb-4">Client Reviews</p>
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-6" style={{ fontFamily: 'Montserrat' }}>
              What Our Customers Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-gradient-to-br from-background to-white p-8 rounded-xl shadow-lg border-l-4 border-primary">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-primary text-2xl">★</span>
                ))}
              </div>
              <p className="text-foreground/80 mb-6 leading-relaxed italic">
                "Richard fixed my stuck front door in less than an hour. Professional, friendly, and fair pricing. Highly recommend!"
              </p>
              <p className="font-bold text-secondary">Sarah M.</p>
              <p className="text-sm text-foreground/60">Montreal, QC</p>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-gradient-to-br from-background to-white p-8 rounded-xl shadow-lg border-l-4 border-primary">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-primary text-2xl">★</span>
                ))}
              </div>
              <p className="text-foreground/80 mb-6 leading-relaxed italic">
                "My dining chairs were falling apart. Richard repaired all four beautifully. They look brand new!"
              </p>
              <p className="font-bold text-secondary">James T.</p>
              <p className="text-sm text-foreground/60">Montreal, QC</p>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-gradient-to-br from-background to-white p-8 rounded-xl shadow-lg border-l-4 border-primary">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-primary text-2xl">★</span>
                ))}
              </div>
              <p className="text-foreground/80 mb-6 leading-relaxed italic">
                "Quick response, professional service, and reasonable rates. Richard is exactly what I needed for my home repairs."
              </p>
              <p className="font-bold text-secondary">Lisa R.</p>
              <p className="text-sm text-foreground/60">Montreal, QC</p>
            </div>
          </div>
        </div>
      </section>

      {/* Work Gallery Section */}
      <section id="work" className="section-divider bg-slate-50">
        <div className="container">
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-[0.4em] text-primary font-semibold mb-4">Our Work</p>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-secondary">
              Recent Repairs & Installations
            </h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto mt-4">
              A selection of door, lock, and furniture repair projects completed for homes and businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {galleryImages.map((image) => (
              <div key={image.src} className="gallery-card">
                <img src={image.src} alt={image.alt} className="gallery-image" />
                <div className="p-4 bg-white">
                  <p className="text-sm text-secondary font-semibold">{image.alt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="section-divider">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-secondary text-center mb-16">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-2xl font-semibold text-secondary mb-3">Contact Us</h3>
              <p className="text-foreground/70 leading-relaxed">
                Call us at <a href="tel:+148383471823" className="font-semibold text-primary hover:underline">+1 (483) 834-7182</a> or fill out our booking form with details about your repair.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-secondary text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-2xl font-semibold text-secondary mb-3">Schedule Visit</h3>
              <p className="text-foreground/70 leading-relaxed">
                We'll confirm your appointment and schedule a time that works best for you. We serve Montreal and surrounding areas.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-2xl font-semibold text-secondary mb-3">We Fix It</h3>
              <p className="text-foreground/70 leading-relaxed">
                Richard arrives with all necessary tools and parts. We complete the repair at your home with minimal disruption.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Booking Section */}
      <section id="contact" className="section-divider bg-white">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-secondary mb-8">
                Get in Touch
              </h2>

              <div className="space-y-6">
                {/* Phone */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-1">Phone</p>
                    <a href="tel:+148383471823" className="text-lg text-primary hover:underline">
                      +1 (483) 834-7182
                    </a>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-1">WhatsApp</p>
                    <a href="https://wa.me/233242011305" className="text-lg text-primary hover:underline">
                      +233 24 201 1305
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-2">Email</p>
                    <div className="space-y-1">
                      <div>
                        <span className="text-sm text-foreground/60">Business:</span>
                        <a href="mailto:info.fixmydoor@gmail.com" className="text-lg text-primary hover:underline ml-1">
                          info.fixmydoor@gmail.com
                        </a>
                      </div>
                      <div>
                        <span className="text-sm text-foreground/60">Personal:</span>
                        <a href="mailto:ampofor55@gmail.com" className="text-lg text-primary hover:underline ml-1">
                          ampofor55@gmail.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Media */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-1">Follow Us</p>
                    <div className="flex gap-4">
                      <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-primary hover:text-primary/80 transition" aria-label="Instagram">
                        <Instagram className="w-5 h-5" />
                      </a>
                      <a href="https://x.com/fixmydoor?s=11" className="text-primary hover:text-primary/80 transition" aria-label="X (Twitter)">
                        <Twitter className="w-5 h-5" />
                      </a>
                      <a href="#" className="text-primary hover:text-primary/80 transition opacity-50" aria-label="Facebook (Coming Soon)">
                        <Facebook className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary mb-1">Service Area</p>
                    <p className="text-foreground/70">
                      10158 Rue Berri<br />
                      Montreal, Quebec H3L 2G6<br />
                      Canada
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Form */}
            <div className="bg-background rounded-lg p-8 border border-border">
              <h3 className="text-2xl font-semibold text-secondary mb-6">Book a Repair</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {/* Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Phone *</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+1 (438) 000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your.email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Address */}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full address in Montreal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Service Type */}
                  <FormField
                    control={form.control}
                    name="repairType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Service Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="door-repair">Door Repair</SelectItem>
                            <SelectItem value="door-alignment">Door Alignment</SelectItem>
                            <SelectItem value="furniture-repair">Furniture Repair</SelectItem>
                            <SelectItem value="chair-repair">Chair Repair</SelectItem>
                            <SelectItem value="table-repair">Table Repair</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preferred Date */}
                  <FormField
                    control={form.control}
                    name="preferredDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Preferred Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your repair needs in detail..."
                            className="min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <Button type="submit" className="btn-primary w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Submitting..." : "Submit Booking Request"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden z-40 flex gap-2">
        <a href="tel:+148383471823" className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-2 px-3 rounded-lg text-center text-sm">
          Call
        </a>
        <a href="#contact" className="flex-1 bg-secondary hover:bg-secondary/90 text-white font-bold py-2 px-3 rounded-lg text-center text-sm">
          Book
        </a>
      </div>

      {/* Footer */}
      <footer className="bg-secondary text-white py-16">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="w-7 h-7" />
                <h3 className="text-2xl font-bold" style={{ fontFamily: 'Montserrat' }}>FixMyDoor</h3>
              </div>
              <p className="text-white/90 leading-relaxed">Professional door and furniture repair services in Montreal, delivered with expertise and care.</p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold mb-4" style={{ fontFamily: 'Montserrat' }}>Quick Links</h4>
              <ul className="space-y-3 text-white/80">
                <li><a href="#services" className="hover:text-primary transition">Services</a></li>
                <li><a href="#before-after" className="hover:text-primary transition">Gallery</a></li>
                <li><a href="#about" className="hover:text-primary transition">About</a></li>
                <li><a href="#contact" className="hover:text-primary transition">Contact</a></li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-bold mb-4" style={{ fontFamily: 'Montserrat' }}>Our Services</h4>
              <ul className="space-y-3 text-white/80">
                <li className="hover:text-primary transition">Door Repair</li>
                <li className="hover:text-primary transition">Lock & Hinge Fixing</li>
                <li className="hover:text-primary transition">Chair Repair</li>
                <li className="hover:text-primary transition">Furniture Repairs</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold mb-4" style={{ fontFamily: 'Montserrat' }}>Get in Touch</h4>
              <ul className="space-y-3 text-white/80">
                <li>
                  <a href="tel:+148383471823" className="hover:text-primary transition font-semibold">
                    +1 (483) 834-7182
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/233242011305" className="hover:text-primary transition text-sm">
                    WhatsApp: +233 24 201 1305
                  </a>
                </li>
                <li className="text-sm">Montreal, QC</li>
              </ul>
              <div className="flex gap-3 mt-4">
                <a href="https://www.instagram.com/fixmydoor_services?igsh=MWpqdXVmZDI2a3dyYw%3D%3D&utm_source=qr" className="text-white/80 hover:text-primary transition" aria-label="Instagram">
                  <Instagram className="w-6 h-6" />
                </a>
                <a href="https://x.com/fixmydoor?s=11" className="text-white/80 hover:text-primary transition" aria-label="X (Twitter)">
                  <Twitter className="w-6 h-6" />
                </a>
                <a href="#" className="text-white/80 hover:text-primary transition opacity-50" aria-label="Facebook">
                  <Facebook className="w-6 h-6" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-primary/30 pt-8">
            <p className="text-center text-white/80 font-medium">
              &copy; 2026 FixMyDoor. Professional Repair Services in Montreal | All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
