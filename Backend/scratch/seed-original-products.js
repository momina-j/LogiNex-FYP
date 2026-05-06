const { db } = require('../firebase-config');

async function seedOriginals() {
  const products = [
    {
      name: 'Loginex Performance Shoes',
      description: 'Ultra-lightweight transit footwear designed for maximum mobility and grip.',
      price: 8500,
      stock: 120,
      category: 'Footwear',
      imageUrl: '/products/shoes.png',
      status: 'active',
      partnerId: 'hp1',
      createdAt: new Date().toISOString()
    },
    {
      name: 'Loginex Urban Jacket',
      description: 'Water-resistant tactical jacket with optimized storage for field electronics.',
      price: 14500,
      stock: 45,
      category: 'Fashion',
      imageUrl: '/products/jacket.png',
      status: 'active',
      partnerId: 'hp1',
      createdAt: new Date().toISOString()
    },
    {
      name: 'Smart Earbuds Pro',
      description: 'High-fidelity audio with active noise cancellation for connected logistics.',
      price: 12000,
      stock: 80,
      category: 'Electronics',
      imageUrl: '/products/earbuds.png',
      status: 'active',
      partnerId: 'hp1',
      createdAt: new Date().toISOString()
    },
    {
      name: 'Loginex Signature Cap (Blue)',
      description: 'Breathable cotton cap featuring the original Loginex embroidered logo.',
      price: 1500,
      stock: 200,
      category: 'Accessories',
      imageUrl: '/products/cap_blue.png',
      status: 'active',
      partnerId: 'hp2',
      createdAt: new Date().toISOString()
    },
    {
      name: 'Loginex Sport Shirt (Red)',
      description: 'Premium moisture-wicking fabric for peak performance in any environment.',
      price: 3200,
      stock: 150,
      category: 'Fashion',
      imageUrl: '/products/shirt_red.png',
      status: 'active',
      partnerId: 'hp2',
      createdAt: new Date().toISOString()
    }
  ];

  try {
    console.log('--- Seeding Original Products ---');
    // First, clear my previously seeded products with Unsplash images
    // In a real scenario, we might want to be more careful, but for this "restore", 
    // we want to move towards the original set.
    
    // We'll just add the new ones.
    for (const p of products) {
      const ref = db.collection('ecommerce_products').doc();
      await ref.set(p);
      console.log(`Restored: ${p.name}`);
    }
    console.log('--- Seeding Complete ---');
  } catch (err) {
    console.error('Seed Failed:', err);
  } finally {
    process.exit();
  }
}

seedOriginals();
