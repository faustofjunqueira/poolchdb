const Pouchdb = require("pouchdb");
const _ = require("lodash");
const LinkedList = require("linkedlist");

/**
 * Validate parameters
 * 
 * @param {any} dbname 
 * @param {any} pool 
 * @param {any} options 
 */
function validation(dbname, pool, options) {
  if (!_.isString(name)) {
    throw new TypeError("Dbname is not string");
  }

  if (pool && !_.isInteger(pool)) {
    throw new TypeError("pool is not a integer");
  }

  if (options && !_.isObject(options)) {
    throw new TypeError("options is not a object");
  }
}

/**
 * get next node in circular view
 * 
 * @param {any} list 
 * @returns 
 */
function nextNode(list) {
  let node = list.next();
  if (!node) {
    list.resetCursor();
    node = list.next();
  }
  return node;
}

function resolveWaitingConnection(waitConnections, dbConnectionPool) {
  let promise = null;
  if(promise = waitConnections.removeCurrent()){
    promise.resolve(dbConnectionPool);
  }
}

/**
 * Find connections is no use
 * 
 * @param {LinkedList} list poolConnection
 */
function findConnection(list) {
  const initialCurrentNode = list.current;

  /**
   * Try find a node no busy
   */
  let currentNode = initialCurrentNode;
  do {
    if (!currentNode.busy) {
      return Promise.resolve(currentNode.db);
    }
  } while ((currentNode = nextNode(list)) != initialCurrentNode);

  return new Promise((resolve, reject) => waitConnections.push({
    resolve,
    reject
  }));
}

/**
 * Factory to create a pool connections
 * 
 * @param {string} dbname pouchdb dbname
 * @param {number} pool Number connections default 5
 * @param {object} options pouchdb options: pouchdb default options
 */
module.export = function factory(dbname, pool, options) {

  validation(dbname, pool, options);
  const poolConnections = new LinkedList();
  const waitConnections = new LinkedList();

  if (!pool) {
    pool = 5; //Default
  }

  for(let i = 0; i < pool; i++) 
    poolConnections.push({db: new Pouchdb(dbname, options), busy: false});

  return function (fn) {

    if (!_.isFunction(fn)) {
      throw new TypeError("Fn is not a function");
    }

    return findConnection(poolConnections)
      .then(dbConnectionPool => {
        dbConnectionPool.busy = true;
        const dbProcessorResult = fn(dbConnectionPool.db);
        if(dbProcessorResult instanceof Promise){
          return dbProcessorResult.then(result => {
            dbConnectionPool.busy = false;
            setImmediate(() => resolveWaitingConnection(waitConnections, dbConnectionPool))
            return result;
          })
        }else{
          dbConnectionPool.busy = false;
          setImmediate(() => resolveWaitingConnection(waitConnections, dbConnectionPool))
          return dbProcessorResult;
        }
      });
  }
}