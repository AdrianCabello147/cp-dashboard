const PRODUCTION_SHEET_ID = "1JXb_hDVffwIROxcKmDm6hekccwR50MN9TnVZ-fDRzwM";
const PRODUCTION_SHEET_NAME = "OT";

const productionUrl =
    `https://docs.google.com/spreadsheets/d/${PRODUCTION_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${PRODUCTION_SHEET_NAME}`;

fetch(productionUrl)
    .then(response => response.text())
    .then(text => {

        const json = JSON.parse(text.substring(47).slice(0, -2));
        const rows = json.table.rows;

        const productionData = importarProductionOrders(rows);

        const processedData = procesarProductionOrders(productionData);

        renderProduction(processedData);

        // console.log(processedData);

    });

function importarProductionOrders(rows) {

    const productionOrders = {};

    rows.forEach(row => {

        const productionOrder = row.c[2]?.v;

        if (!productionOrder) return;

        if (!productionOrders[productionOrder]) {

            productionOrders[productionOrder] = {

                productionOrder,

                owner: "",

                salesOrder: row.c[1]?.v || "",

                creationDate: row.c[3]?.f || row.c[3]?.v || "",

                dueDate: row.c[7]?.f || row.c[7]?.v || "",

                status: row.c[4]?.v || "",

                customer: row.c[8]?.v || "",

                customSolution: row.c[9]?.v || "",

                description: row.c[10]?.v || "",

                tasks: [],

                checklist: {},

                risk: "Normal",

                progress: 0,

                components: []

            };

        }

        productionOrders[productionOrder].components.push({

            itemCode: row.c[15]?.v || "",

            description: row.c[16]?.v || "",

            requiredQty: row.c[17]?.v || 0,

            stock: row.c[20]?.v || 0,

            hasStock: row.c[21]?.v || "",

            picking: row.c[24]?.v || "",

            pickingStatus: row.c[25]?.v || "",

            releasedQty: row.c[26]?.v || 0,

            pickedQty: row.c[27]?.v || 0,

            componentStatus: row.c[28]?.v || ""

        });

    });

    return Object.values(productionOrders).map(ot => {

        const totalComponents = ot.components.length;

        const missingComponents = ot.components.filter(component =>
            component.componentStatus.toLowerCase().includes("sin stock")
        ).length;

        const pickingPending = ot.components.filter(component =>
            component.componentStatus.toLowerCase().includes("pick")
        ).length;

        const readyInWorkshop = ot.components.filter(component =>
            component.componentStatus.toLowerCase().includes("taller")
        ).length;

        return {

            ...ot,

            totalComponents,

            missingComponents,

            pickingPending,

            readyInWorkshop,

            prioridad: calcularPrioridad(ot.dueDate),

            supportDate: calcularFechaSoportes(ot.dueDate)

        };

    });

}