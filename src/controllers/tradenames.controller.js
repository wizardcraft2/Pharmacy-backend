import Drug from '../models/Drug.js';
export const getData = async (req, res) => {
    const params = req.query;
    let { page_index, per_page } = params;
    page_index = page_index ? page_index : 1;
    per_page = per_page ? per_page : 12;
    const query = "Pharmaceutical drugs and health products trade names";
    console.log(query);
    const data = await Drug.find({
        category_name: query
    }).skip((page_index) * per_page).limit(per_page);

    const total_count = await Drug.countDocuments({
        category_name: query
    });

    res.json({
        data: data,
        total_count: total_count
    });
}