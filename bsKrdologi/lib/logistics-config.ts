/**
 * LOGISTICS_CONFIG
 * Pricing and vehicle specifications for the Loginex platform.
 * Data updated: April 2026.
 */

export const LOGISTICS_CONFIG = {
  // Fuel Prices in PKR (Updated April 2026)
  fuelPrices: {
    petrol: 458.41,
    diesel: 520.35,
    electric: 1.50, // Cost per km for EV bikes/vans
    currency: "PKR",
  },

  // Vehicle-specific operational costs and capacity
  vehicles: {
    bike: {
      type: "bike",
      baseRate: 150,
      ratePerKg: 50,
      fuelAvg: 45, // km per liter
      maxWeightKg: 20,
      maintenancePerKm: 2,
      fuelType: "petrol",
    },
    car: {
      type: "car",
      baseRate: 350,
      ratePerKg: 90,
      fuelAvg: 14, // km per liter
      maxWeightKg: 200,
      maintenancePerKm: 5,
      fuelType: "petrol",
    },
    // Auto Rickshaw specs and raw user benchmark test cases 
    rickshaw: {
      type: "rickshaw",
      baseRate: 220,
      ratePerKg: 65,
      fuelAvg: 22, // km per liter (CNG/Petrol mix equivalent)
      maxWeightKg: 150,
      maintenancePerKm: 4,
      fuelType: "petrol",
      testBenchmarks: [
        { city: "Karachi (Gulshan -> Clifton)", dist: "12 km", weight: "30 kg", vol: "25 kg", shift: "Day", price: "~950 PKR" },
        { city: "Lahore (Johar Town -> Mall Road)", dist: "8 km", weight: "50 kg", vol: "60 kg", shift: "Night + Congestion", price: "~1,450 PKR" },
        { city: "Islamabad (F-10 -> Blue Area)", dist: "6 km", weight: "20 kg", vol: "18 kg", shift: "Day", price: "~650 PKR" },
        { city: "Rawalpindi (Saddar -> Raja Bazaar)", dist: "5 km", weight: "100 kg", vol: "80 kg", shift: "Day + Congestion", price: "~1,100 PKR" },
        { city: "Multan (City Center)", dist: "4 km", weight: "15 kg", vol: "12 kg", shift: "Day", price: "~500 PKR" }
      ]
    },
    van: {
      type: "van",
      baseRate: 800,
      ratePerKg: 40,
      fuelAvg: 10, // km per liter
      maxWeightKg: 1000,
      maintenancePerKm: 8,
      fuelType: "diesel",
    },
    truck: {
      type: "truck",
      baseRate: 2500,
      ratePerKg: 25,
      fuelAvg: 4, // km per liter (Heavy Diesel)
      maxWeightKg: 5000,
      maintenancePerKm: 15,
      fuelType: "diesel",
    }
  },

  // Extra charges and business logic
  surcharges: {
    fuelSurchargePercentage: 12, // Standard industry tax for fuel volatility
    serviceFee: 50,              // Platform/App fee
    volumetricDivisor: 5000,     // For (L * W * H) / 5000 calculation
  }
};
