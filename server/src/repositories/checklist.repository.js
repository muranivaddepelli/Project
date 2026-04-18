const { ChecklistEntry, Task } = require('../models');
const { formatHospitalLabel } = require('../utils/formatHospitalLabel');

class ChecklistRepository {
  async create(entryData) {
    const entry = new ChecklistEntry(entryData);
    return await entry.save();
  }

  async findById(id) {
    return await ChecklistEntry.findById(id)
      .populate({
        path: 'task',
        populate: { path: 'area', select: 'name code' }
      })
      .populate('completedBy', 'name email')
      .populate('hospital', 'name code');
  }

  async findByTaskAndDate(taskId, date, hospitalId = null) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      task: taskId,
      date: { $gte: startOfDay, $lte: endOfDay }
    };
    
    if (hospitalId) {
      query.hospital = hospitalId;
    }

    return await ChecklistEntry.findOne(query);
  }

  async findByDate(date, areaId = null, hospitalId = null) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Build task filter
    let taskFilter = { isActive: true };
    if (areaId) {
      taskFilter.area = areaId;
    }

    // If hospitalId provided, filter tasks by their area's hospital at DB level
    if (hospitalId) {
      const { Area } = require('../models');
      const hospitalAreas = await Area.find({ hospital: hospitalId }).select('_id');
      const areaIds = hospitalAreas.map(a => a._id);
      
      if (areaIds.length > 0) {
        if (areaId) {
          // If both areaId and hospitalId specified, verify area belongs to hospital
          const areaInHospital = areaIds.some(id => id.toString() === areaId);
          if (!areaInHospital) {
            return []; // Area doesn't belong to this hospital
          }
        } else {
          // Filter to only areas in this hospital
          taskFilter.area = { $in: areaIds };
        }
      } else {
        return []; // No areas for this hospital
      }
    }

    // Get tasks and populate area with hospital
    const tasks = await Task.find(taskFilter)
      .populate({
        path: 'area',
        select: 'name code hospital',
        populate: { path: 'hospital', select: 'name code' }
      })
      .sort({ area: 1, order: 1, taskId: 1 });

    // Get existing entries for the date
    const entryFilter = {
      date: { $gte: startOfDay, $lte: endOfDay }
    };

    const entries = await ChecklistEntry.find(entryFilter)
      .populate('completedBy', 'name email');

    // Create a map of entries by task ID
    const entryMap = new Map();
    entries.forEach(entry => {
      entryMap.set(entry.task.toString(), entry);
    });

    // Merge tasks with their entries
    const result = tasks.map(task => {
      const entry = entryMap.get(task._id.toString());
      return {
        task: {
          _id: task._id,
          taskId: task.taskId,
          name: task.name,
          description: task.description,
          area: {
            _id: task.area?._id,
            name: task.area?.name,
            code: task.area?.code,
            hospital: task.area?.hospital
          }
        },
        entry: entry ? {
          _id: entry._id,
          status: entry.status,
          staffName: entry.staffName,
          completedAt: entry.completedAt,
          completedBy: entry.completedBy,
          notes: entry.notes
        } : null
      };
    });

    return result;
  }

  async upsert(taskId, date, updateData, hospitalId = null) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const filter = { task: taskId, date: startOfDay };
    if (hospitalId) {
      filter.hospital = hospitalId;
    }

    const updateObj = { 
      ...updateData, 
      task: taskId, 
      date: startOfDay,
      updatedAt: new Date()
    };
    
    if (hospitalId) {
      updateObj.hospital = hospitalId;
    }

    return await ChecklistEntry.findOneAndUpdate(
      filter,
      updateObj,
      { new: true, upsert: true, runValidators: true }
    ).populate({
      path: 'task',
      populate: { path: 'area', select: 'name code' }
    });
  }

  async bulkUpsert(entries, hospitalId = null) {
    const operations = entries.map(entry => {
      const startOfDay = new Date(entry.date);
      startOfDay.setHours(0, 0, 0, 0);

      // Filter without hospital to find existing entries
      const filter = { task: entry.taskId, date: startOfDay };

      // Only set hospital on insert, not on update (to avoid conflict)
      const setOnInsert = {
        task: entry.taskId,
        date: startOfDay
      };
      if (hospitalId) {
        setOnInsert.hospital = hospitalId;
      }

      return {
        updateOne: {
          filter,
          update: {
            $set: {
              status: entry.status,
              staffName: entry.staffName,
              completedAt: entry.status ? new Date() : null,
              completedBy: entry.completedBy,
              updatedAt: new Date()
            },
            $setOnInsert: setOnInsert
          },
          upsert: true
        }
      };
    });

    return await ChecklistEntry.bulkWrite(operations);
  }

  async getEntriesForExport(date, areaId = null, hospitalId = null) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Build task filter
    let taskFilter = { isActive: true };
    if (areaId) {
      taskFilter.area = areaId;
    }

    // If hospitalId provided, filter tasks by their area's hospital at DB level
    if (hospitalId) {
      const { Area } = require('../models');
      const hospitalAreas = await Area.find({ hospital: hospitalId }).select('_id');
      const areaIds = hospitalAreas.map(a => a._id);
      
      if (areaIds.length > 0) {
        if (areaId) {
          const areaInHospital = areaIds.some(id => id.toString() === areaId);
          if (!areaInHospital) {
            return [];
          }
        } else {
          taskFilter.area = { $in: areaIds };
        }
      } else {
        return [];
      }
    }

    const tasks = await Task.find(taskFilter)
      .populate({
        path: 'area',
        select: 'name code hospital',
        populate: { path: 'hospital', select: 'name code' }
      })
      .sort({ area: 1, order: 1, taskId: 1 });

    const entryFilter = {
      date: { $gte: startOfDay, $lte: endOfDay }
    };

    const entries = await ChecklistEntry.find(entryFilter);

    const entryMap = new Map();
    entries.forEach(entry => {
      entryMap.set(entry.task.toString(), entry);
    });

    return tasks.map(task => {
      const entry = entryMap.get(task._id.toString());
      return {
        taskId: task.taskId,
        // hospital: formatHospitalLabel(task.area?.hospital),
        hospital: task.area?.hospital?.name || '',
        area: task.area?.name || '',
        taskName: task.name,
        description: task.description,
        status: entry ? (entry.status ? 'Yes' : 'No') : 'No',
        staffName: entry?.staffName || '',
        timestamp: entry?.completedAt ? 
          new Date(entry.completedAt).toLocaleString('en-US') : ''
      };
    });
  }

  // Get entries for a date range (filter by createdAt - when entry was created)
  async getEntriesForDateRange(startDate, endDate, areaId = null, hospitalId = null) {
    // Parse dates
    const startOfRange = new Date(startDate);
    startOfRange.setHours(0, 0, 0, 0);
    
    const endOfRange = new Date(endDate);
    endOfRange.setHours(23, 59, 59, 999);

    // Build entry filter - filter by createdAt (when the entry was created)
    const entryFilter = {
      createdAt: { $gte: startOfRange, $lte: endOfRange }
    };

    // If hospitalId provided, find areas that belong to this hospital first
    let areaIds = null;
    if (hospitalId) {
      const { Area } = require('../models');
      const hospitalAreas = await Area.find({ hospital: hospitalId }).select('_id');
      areaIds = hospitalAreas.map(a => a._id.toString());
      
      if (areaIds.length === 0) {
        return []; // No areas for this hospital
      }
    }

    // Get entries within the createdAt date range
    const entries = await ChecklistEntry.find(entryFilter)
      .populate({
        path: 'task',
        populate: {
          path: 'area',
          select: 'name code hospital',
          populate: { path: 'hospital', select: 'name code' }
        }
      })
      .populate('completedBy', 'name email')
      .sort({ createdAt: -1 });

    // Filter entries by area and hospital
    let filteredEntries = entries.filter(entry => {
      // Skip if task is missing
      if (!entry.task) return false;
      
      // Filter by area if specified
      if (areaId && entry.task?.area?._id?.toString() !== areaId) {
        return false;
      }
      
      // Filter by hospital (via area)
      if (areaIds && !areaIds.includes(entry.task?.area?._id?.toString())) {
        return false;
      }
      
      return true;
    });

    // Map to export format
    return filteredEntries.map(entry => ({
      date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : '',
      taskId: entry.task?.taskId || '',
      area: entry.task?.area?.name || '',
      hospital: formatHospitalLabel(entry.task?.area?.hospital),
      taskName: entry.task?.name || '',
      description: entry.task?.description || '',
      status: entry.status ? 'Yes' : 'No',
      staffName: entry.staffName || '',
      createdAt: entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-US') : '',
      completedAt: entry.completedAt ? new Date(entry.completedAt).toLocaleString('en-US') : ''
    }));
  }

  async delete(id) {
    return await ChecklistEntry.findByIdAndDelete(id);
  }
}

module.exports = new ChecklistRepository();

