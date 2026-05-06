const { db, admin } = require('./firebase-config');

const partnerId = 'demo_partner_123';

const categoriesItems = [
  {
    name: 'Cotton T-Shirt',
    description: 'A sleek modern premium t-shirt made of 100% organic cotton. Comfortable and durable.',
    price: 1500,
    category: 'Shirts',
    baseImage: 'shirt.png',
    variants: [
      { colorName: 'Crimson Red', stock: 120, img: '/products/shirt_red.png' },
      { colorName: 'Midnight Black', stock: 85, img: '/products/shirt.png' },
      { colorName: 'Navy Blue', stock: 200, img: '/products/shirt_blue.png' }
    ]
  },
  {
    name: 'Minimalist Signature Cap',
    description: 'Stylish minimalist baseball cap with an adjustable strap.',
    price: 850,
    category: 'Caps',
    baseImage: 'cap.png',
    variants: [
      { colorName: 'Crimson Red', stock: 120, img: '/products/cap_red.png' },
      { colorName: 'Midnight Black', stock: 85, img: '/products/cap.png' },
      { colorName: 'Navy Blue', stock: 200, img: '/products/cap_blue.png' }
    ]
  },
  {
    name: 'Urban Lifestyle Sneakers',
    description: 'Premium modern sneakers designed for everyday comfort and urban style.',
    price: 4500,
    category: 'Shoes',
    baseImage: 'shoes.png',
    variants: [
      { colorName: 'Crimson Red', stock: 120, img: '/products/shoe_red.png' },
      { colorName: 'Midnight Black', stock: 85, img: '/products/shoes.png' },
      { colorName: 'Navy Blue', stock: 200, img: '/products/shoe_blue.png' }
    ]
  },
  {
    name: 'Classic Denim Jacket',
    description: 'A trendy premium denim jacket tailored for a modern fit.',
    price: 6500,
    category: 'Jackets',
    baseImage: 'jacket.png',
    variants: [
      { colorName: 'Crimson Red', stock: 120, img: '/products/jacket.png' },
      { colorName: 'Midnight Black', stock: 85, img: '/products/jacket.png' },
      { colorName: 'Navy Blue', stock: 200, img: '/products/jacket.png' }
    ]
  },
  {
    name: 'Wireless Pro Earbuds',
    description: 'Sleek wireless earbuds with active noise cancellation and a premium charging case.',
    price: 3200,
    category: 'Earbuds',
    baseImage: 'earbuds.png',
    variants: [
      { colorName: 'Crimson Red', stock: 120, img: '/products/earbuds.png' },
      { colorName: 'Midnight Black', stock: 85, img: '/products/earbuds.png' },
      { colorName: 'Navy Blue', stock: 200, img: '/products/earbuds.png' }
    ]
  }
];

async function seedData() {
  try {
    console.log('Clearing old product data for demo partner...');
    const productsRef = db.collection('ecommerce_products');
    const snapshot = await productsRef.where('partnerId', '==', partnerId).get();
    
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    console.log('Generating colored variants...');
    
    let generatedCount = 0;
    for (const item of categoriesItems) {
       for (const variant of item.variants) {
          const newProduct = {
             partnerId,
             name: `${item.name} - ${variant.colorName}`,
             description: `${item.description} (Color: ${variant.colorName})`,
             price: item.price,
             stock: variant.stock,
             category: item.category,
             imageUrl: variant.img,
             status: 'active',
             createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          
          await productsRef.add(newProduct);
          generatedCount++;
          console.log(`- Created product: ${newProduct.name}`);
       }
    }
    
    console.log(`\nSeeding completed successfully! ${generatedCount} items created.`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
