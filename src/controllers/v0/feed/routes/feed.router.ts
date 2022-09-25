import { Router, Request, Response } from 'express';
import { FeedItem } from '../models/FeedItem';
import { requireAuth } from '../../users/routes/auth.router';
import * as AWS from '../../../../aws';

const router: Router = Router();

// Get all feed items
router.get('/', async (req: Request, res: Response) => {
    console.log('Received request to fetch all feeds!!!');
    const items = await FeedItem.findAndCountAll({order: [['id', 'DESC']]});
    console.log('Received items: %s', items.count);
    items.rows.map((item) => {
            if (item.url) {
                item.url = AWS.getGetSignedUrl(item.url);
            }
    });
    res.send(items);
});

// @TODO

router.get('/:id', requireAuth, 
   async (req: Request, res: Response) => {
    console.log('Received command to fetch feed by id: ', req.params.id);
    const id = req.params.id;
    if (!id) {
        res.status(400).send('Bad request to update a feed. An id is needed.');
    }
    let item: FeedItem;
    try{
        item = await FeedItem.findOne({ where: { id: Number(id) } });
        if (!item) {
            res.status(404).send('Item not found for id: ' + id);
        }
    } catch(e){
        throw e;        
    }
    item.url = AWS.getGetSignedUrl(item.url);
    res.status(200).send(item);
   }
);

// update a specific resource
router.patch('/:id',
    requireAuth,
    async (req: Request, res: Response) => {
        console.log('Received a feed to update for id: %s with body: %s', req.params.id, JSON.stringify(req.body));
        const id = req.params.id;
        const {caption, url} = req.body;
        if (!id) {
            res.status(400).send('Bad request to update a feed. An id is needed.');
        }

        const item = await FeedItem.findOne({ where: { id: Number(id) } });
        if (!item) {
            res.status(404).send('Item not found fot id: ' + id);
        }

        await FeedItem.update({
            caption: caption,
            url: url
        },{
            where: {id: Number(id)}
        });

        const updated: FeedItem = await FeedItem.findOne({ where: { id: Number(id) } });
        updated.url = AWS.getGetSignedUrl(updated.url);   
        res.status(200).send(updated);
});


// Get a signed url to put a new item in the bucket
router.get('/signed-url/:fileName',
    requireAuth,
    async (req: Request, res: Response) => {
    const { fileName } = req.params;
    console.log('received filename: %s', fileName);
    
    const url = AWS.getPutSignedUrl(fileName);
    res.status(201).send({url: url});
});

// Post meta data and the filename after a file is uploaded
// NOTE the file name is they key name in the s3 bucket.
// body : {caption: string, fileName: string};
router.post('/',
    requireAuth,
    async (req: Request, res: Response) => {
    const caption = req.body.caption;
    const fileName = req.body.url;

    // check Caption is valid
    if (!caption) {
        return res.status(400).send({ message: 'Caption is required or malformed' });
    }

    // check Filename is valid
    if (!fileName) {
        return res.status(400).send({ message: 'File url is required' });
    }

    const item = new FeedItem({
            caption: caption,
            url: fileName
    });

    const saved_item = await item.save();

    saved_item.url = AWS.getGetSignedUrl(saved_item.url);
    res.status(201).send(saved_item);
});

export const FeedRouter: Router = router;
