const { db } = require('../firebase-config');

async function seed() {
  const products = [
    {
      name: 'Sony WH-1000XM5',
      description: 'Industry leading noise canceling wireless headphones with Alexa built-in.',
      price: 29000,
      stock: 50,
      category: 'Electronics',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
      status: 'active',
      partnerId: 'hp1',
      createdAt: new Date().toISOString()
    },
    {
      name: 'iPhone 15 Pro Max (Titanium)',
      description: 'The latest flagship from Apple with Aerospace-grade titanium design.',
      price: 185000,
      stock: 15,
      category: 'Electronics',
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
      status: 'active',
      partnerId: 'hp1',
      createdAt: new Date().toISOString()
    },
    {
      name: 'Modern Leather Jacket',
      description: 'Premium buffalo leather jacket, perfect for any season.',
      price: 12500,
      stock: 30,
      category: 'Fashion',
      imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80',
      status: 'active',
      partnerId: 'hp2',
      createdAt: new Date().toISOString()
    },
    {
      name: 'Nike Air Max 270',
      description: 'Nike air max 270 shoes with ultimate comfort.',
      price: 15000,
      stock: 100,
      category: 'Footwear',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
      status: 'active',
      partnerId: 'hp2',
      createdAt: new Date().toISOString()
    }
  ];

  try {
    console.log('--- Seeding Products ---');
    for (const p of products) {
      const ref = db.collection('ecommerce_products').doc();
      await ref.set(p);
      console.log(`Seed: ${p.name}`);
    }
    console.log('--- Seeding Complete ---');
  } catch (err) {
    console.error('Seed Failed:', err);
  } finally {
    process.exit();
  }
}

seed();
