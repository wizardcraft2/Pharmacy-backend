import Drug from '../models/Drug.js';
export const getData = async (req, res) => {
    const params = req.query;
      
    let { query, page_index, per_page } = params;
    
    page_index = page_index ? page_index : 1;
    per_page = per_page ? per_page : 12;
    query = query ? query : "";
    
    const data = await Drug.find({
        $or: [
            { name: { $regex: query, $options: "i" } },
            { category_name: { $regex: query, $options: "i" } }
        ]
    }).skip((page_index) * per_page).limit(per_page);

    const total_count = await Drug.countDocuments({
        $or: [
            { name: { $regex: query, $options: "i" } },
            { category_name: { $regex: query, $options: "i" } }
        ]
    });

    res.json({
        data: data,
        total_count: total_count
    });
}

// export const exportData = async (req, res) => {
//     try {
//         // Connect to the database using promises
//         const connection = await mysql.createConnection({
//             host: 'localhost',
//             user: 'root',
//             password: 'password',
//             database: 'scraping'
//         });

//         console.log('Connected to MySQL Database!');

//         // Execute a query using promise
//         const [rows, fields] = await connection.execute('SELECT * FROM products');
//         // console.log('Query Result:', rows);
//         const data = [];
//         rows.map((item) => {
//             data.push({
//                 category_name: item['category_name'],
//                 name: item['name'],
//                 information: JSON.parse(item['information']),
//                 link: item['link']
//             })
//         })
//         // console.log(data[0]['information']);
        
//         Drug.insertMany(data);
//         console.log("-----------__ENd------------")
//         // Close the connection
//         await connection.end();
//     } catch (err) {
//         console.error('Error:', err);
//     }
// }